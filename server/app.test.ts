import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app.ts';
import type { ChatClient } from './chat.ts';
import { parseChatRequest } from './chat.ts';

/**
 * Run with `npm run test:server`. Uses a fake Claude client, so no API key
 * is needed and nothing is billed.
 */

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };

interface FakeReply {
  /** Content blocks of Claude's message; text blocks are streamed. */
  content: Block[];
  stopReason?: string;
  /** Thrown after the content has streamed. */
  error?: Error;
}

/** A stand-in for client.beta.messages.stream() that replays `reply`. */
function fakeClient(reply: FakeReply) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(params);
          return {
            abort() {},
            async *[Symbol.asyncIterator]() {
              for (const block of reply.content) {
                yield { type: 'content_block_start', content_block: { ...block, ...(block.type === 'text' ? { text: '' } : {}) } };
                if (block.type === 'text') yield { type: 'content_block_delta', delta: { type: 'text_delta', text: block.text } };
              }
              if (reply.error) throw reply.error;
            },
            finalMessage: async () => ({ content: reply.content, stop_reason: reply.stopReason ?? 'end_turn' }),
          };
        },
      },
    },
  } as unknown as ChatClient;
  return { client, calls };
}

async function listen(app: ReturnType<typeof createApp>): Promise<{ url: string; server: Server }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server }));
  });
}

/** Starts an app with `reply`, runs `test` against it, and stops it. */
async function withServer(reply: FakeReply | null, test: (url: string) => Promise<void>, chatLimit?: number): Promise<void> {
  const { url, server } = await listen(createApp({ client: reply ? fakeClient(reply).client : null, chatLimit }));
  try {
    await test(url);
  } finally {
    server.close();
  }
}

const question = { messages: [{ role: 'user', content: 'Hello' }] };

function post(url: string, body: unknown): Promise<globalThis.Response> {
  return fetch(`${url}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function events(res: globalThis.Response): Promise<unknown[]> {
  return (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('parseChatRequest', () => {
  it('accepts a conversation and passes it on unchanged', () => {
    const messages = [
      { role: 'user', content: 'How many requests?' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'tool_use', id: 't1', name: 'get_overview', input: {} },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"total_requests":130}' }] },
    ];
    assert.deepEqual(parseChatRequest({ messages }), { messages });
  });

  it('rejects missing, empty or malformed messages', () => {
    for (const body of [
      null,
      {},
      { messages: [] },
      { messages: [{ role: 'system', content: 'x' }] },
      { messages: [{ role: 'user', content: '  ' }] },
      { messages: [{ role: 'user', content: [] }] },
      { messages: [{ role: 'user', content: [{ text: 'no type' }] }] },
    ]) {
      assert.equal((parseChatRequest(body) as { status?: number }).status, 400, JSON.stringify(body));
    }
  });

  it('requires the conversation to start and end with the user', () => {
    const hi = { role: 'user', content: 'Hi' };
    const hello = { role: 'assistant', content: 'Hello' };
    assert.ok('error' in parseChatRequest({ messages: [hi, hello] }));
    assert.ok('error' in parseChatRequest({ messages: [hello, hi] }));
  });

  it('limits what the user typed, but not tool results', () => {
    const long = 'x'.repeat(2001);
    assert.ok('error' in parseChatRequest({ messages: [{ role: 'user', content: long }] }));
    assert.ok('error' in parseChatRequest({ messages: [{ role: 'user', content: [{ type: 'text', text: long }] }] }));
    const toolResult = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: long }] };
    assert.ok(!('error' in parseChatRequest({ messages: [toolResult] })));
  });

  it('answers 413 to a conversation that is too long, rather than trimming it', () => {
    const messages = Array.from({ length: 81 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    assert.deepEqual(parseChatRequest({ messages }), { error: 'too_long', status: 413 });
  });
});

describe('server', () => {
  describe('with a Claude client', () => {
    const reply: FakeReply = { content: [{ type: 'text', text: 'Hello!' }] };
    const fake = fakeClient(reply);
    let url: string;
    let server: Server;

    before(async () => ({ url, server } = await listen(createApp({ client: fake.client }))));
    after(() => server.close());

    it('GET /api/health reports the AI as configured and the model in use', async () => {
      assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true, ai: true, model: 'claude-opus-5-5' });
    });

    it('streams the text, then Claude\'s whole turn', async () => {
      const res = await post(url, question);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type')!, /application\/x-ndjson/);
      assert.deepEqual(await events(res), [
        { type: 'text', text: 'Hello!' },
        { type: 'turn', content: reply.content, stopReason: 'end_turn' },
      ]);
    });

    it('sends Claude the conversation with a fixed system prompt, the tools, caching and fallbacks', () => {
      const params = fake.calls[0];
      assert.equal(params['model'], 'claude-opus-5-5');
      assert.deepEqual(params['messages'], question.messages);
      assert.match(String(params['system']), /never guess or invent figures/);
      const tools = params['tools'] as { name: string; eager_input_streaming?: boolean }[];
      assert.deepEqual(
        tools.map((t) => t.name),
        ['get_overview', 'search_purchase_requests', 'get_purchase_request', 'spending_breakdown', 'open_purchase_request'],
      );
      assert.ok(tools.every((t) => t.eager_input_streaming));
      assert.deepEqual(params['cache_control'], { type: 'ephemeral' });
      assert.deepEqual(params['thinking'], { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } });
      assert.equal(params['fallbacks'], 'default');
    });

    it('answers 400 to an invalid request', async () => {
      assert.equal((await post(url, { messages: [] })).status, 400);
    });

    it('unknown /api routes are a JSON 404', async () => {
      assert.equal((await fetch(`${url}/api/nope`)).status, 404);
    });
  });

  it('uses the configured model, and leaves out fallbacks on models without them', async () => {
    const fake = fakeClient({ content: [{ type: 'text', text: 'Hi' }] });
    const { url, server } = await listen(createApp({ client: fake.client, model: 'claude-haiku-5-5' }));
    try {
      assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true, ai: true, model: 'claude-haiku-5-5' });
      await (await post(url, question)).text();
      const params = fake.calls[0];
      assert.equal(params['model'], 'claude-haiku-5-5');
      assert.equal('fallbacks' in params, false);
      assert.deepEqual(params['betas'], ['thinking-binding-controls-2026-08-01']);
    } finally {
      server.close();
    }
  });

  it('a tool call is passed to the browser in the turn, with text before it kept apart', async () => {
    const content: Block[] = [
      { type: 'text', text: 'Let me check.' },
      { type: 'tool_use', id: 't1', name: 'get_overview', input: {} },
      { type: 'text', text: 'Done.' },
    ];
    await withServer({ content, stopReason: 'tool_use' }, async (url) => {
      assert.deepEqual(await events(await post(url, question)), [
        { type: 'text', text: 'Let me check.' },
        { type: 'text', text: '\n\n' },
        { type: 'text', text: 'Done.' },
        { type: 'turn', content, stopReason: 'tool_use' },
      ]);
    });
  });

  it('a tool call cut off by max_tokens is not passed on', async () => {
    const content: Block[] = [{ type: 'tool_use', id: 't1', name: 'search_purchase_requests', input: { query: 'mod' } }];
    await withServer({ content, stopReason: 'max_tokens' }, async (url) => {
      assert.deepEqual(await events(await post(url, question)), [{ type: 'error', code: 'failed' }]);
    });
  });

  it('a refusal ends the stream with an error event', async () => {
    await withServer({ content: [], stopReason: 'refusal' }, async (url) => {
      assert.deepEqual(await events(await post(url, question)), [{ type: 'error', code: 'refusal' }]);
    });
  });

  it('an API failure mid-stream keeps the text so far and ends with an error event', async () => {
    const overloaded = new Anthropic.InternalServerError(529, { type: 'overloaded_error' }, 'Overloaded', new Headers());
    const log = console.error;
    console.error = () => {};
    try {
      await withServer({ content: [{ type: 'text', text: 'Part' }], error: overloaded }, async (url) => {
        assert.deepEqual(await events(await post(url, question)), [
          { type: 'text', text: 'Part' },
          { type: 'error', code: 'busy' },
        ]);
      });
    } finally {
      console.error = log;
    }
  });

  it('answers 429 once a visitor passes the rate limit', async () => {
    await withServer(
      { content: [{ type: 'text', text: 'Hi' }] },
      async (url) => {
        assert.equal((await post(url, question)).status, 200);
        const res = await post(url, question);
        assert.equal(res.status, 429);
        assert.deepEqual(await res.json(), { error: 'rate_limited' });
      },
      1,
    );
  });

  it('without an API key the chat answers 503 not_configured', async () => {
    await withServer(null, async (url) => {
      assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true, ai: false, model: 'claude-opus-5-5' });
      const res = await post(url, question);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'not_configured' });
    });
  });
});
