import type Anthropic from '@anthropic-ai/sdk';
import { TestBed } from '@angular/core/testing';
import { CHAT_LIMITS, ChatEvent, ChatRequest } from '../models/chat.model';
import { ChatToolsService } from './chat-tools.service';
import { CHAT_URL, ChatService } from './chat.service';

type Block = Anthropic.Beta.BetaContentBlock;

const textBlock = (text: string) => ({ type: 'text', text, citations: null }) as Block;
const toolUse = (id: string, name: string, input: unknown = {}) => ({ type: 'tool_use', id, name, input }) as Block;
const turn = (content: Block[], stopReason: 'end_turn' | 'tool_use' = 'end_turn'): ChatEvent => ({ type: 'turn', content, stopReason });

/**
 * A fake fetch() for /api/chat. Each call gets its own streaming 200
 * response, which the test writes to with `reply(n).emit()`; aborting the
 * request errors the stream, as a real fetch does.
 */
function fakeServer() {
  const encoder = new TextEncoder();
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        streams.push(c);
        init.signal?.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')));
      },
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);

  /** Waits for request `n` (0-based) to be made. */
  const waitForRequest = (n: number) => vi.waitFor(() => expect(streams.length).toBeGreaterThan(n));

  return {
    fetchMock,
    request: (n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body as string) as ChatRequest,
    async reply(n: number, ...events: ChatEvent[]) {
      await waitForRequest(n);
      streams[n].enqueue(encoder.encode(events.map((e) => JSON.stringify(e) + '\n').join('')));
    },
    /** Writes raw text, so a test can split a line across chunks. */
    async write(n: number, text: string) {
      await waitForRequest(n);
      streams[n].enqueue(encoder.encode(text));
    },
    async end(n: number) {
      await waitForRequest(n);
      streams[n].close();
    },
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let runTool: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(ChatService);
    runTool = vi
      .spyOn(TestBed.inject(ChatToolsService), 'run')
      .mockImplementation((name) => ({ content: `{"tool":"${name}"}`, isError: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  const reply = () => service.messages()[1];

  it('starts closed with an empty conversation', () => {
    expect(service.isOpen()).toBe(false);
    expect(service.messages()).toEqual([]);
    expect(service.busy()).toBe(false);
  });

  it('toggle() opens and closes the panel; close() closes it', () => {
    service.toggle();
    expect(service.isOpen()).toBe(true);
    service.toggle();
    expect(service.isOpen()).toBe(false);
    service.toggle();
    service.close();
    expect(service.isOpen()).toBe(false);
  });

  it('POSTs the trimmed message, then streams the reply in', async () => {
    const server = fakeServer();
    const done = service.send('  How many requests?  ');

    expect(service.messages()[0]).toEqual({ id: expect.any(Number), role: 'user', text: 'How many requests?', status: 'done' });
    expect(reply()).toMatchObject({ role: 'assistant', text: '', status: 'streaming' });
    expect(service.busy()).toBe(true);
    expect(server.fetchMock).toHaveBeenCalledWith(CHAT_URL, expect.objectContaining({ method: 'POST' }));
    expect(server.request()).toEqual({ messages: [{ role: 'user', content: 'How many requests?' }] });

    await server.reply(0, { type: 'text', text: 'There are ' });
    await vi.waitFor(() => expect(reply().text).toBe('There are '));

    // A line split across two chunks is joined before parsing.
    await server.write(0, '{"type":"text",');
    await server.write(0, '"text":"130."}\n');
    await server.reply(0, turn([textBlock('There are 130.')]));
    await done;

    expect(reply()).toMatchObject({ text: 'There are 130.', status: 'done' });
    expect(service.busy()).toBe(false);
  });

  it('runs the tools Claude asks for and sends the results back, until Claude answers', async () => {
    const server = fakeServer();
    const done = service.send('Pending requests?');

    const toolTurn = [textBlock('Let me check.'), toolUse('t1', 'get_overview'), toolUse('t2', 'search_purchase_requests', { stage: 'inProgress' })];
    await server.reply(0, { type: 'text', text: 'Let me check.' }, turn(toolTurn, 'tool_use'));

    // Both calls ran, and their results went back together in one message.
    await vi.waitFor(() => expect(server.fetchMock).toHaveBeenCalledTimes(2));
    expect(runTool).toHaveBeenCalledWith('get_overview', {});
    expect(runTool).toHaveBeenCalledWith('search_purchase_requests', { stage: 'inProgress' });
    expect(server.request(1).messages).toEqual([
      { role: 'user', content: 'Pending requests?' },
      { role: 'assistant', content: toolTurn },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: '{"tool":"get_overview"}', is_error: false },
          { type: 'tool_result', tool_use_id: 't2', content: '{"tool":"search_purchase_requests"}', is_error: false },
        ],
      },
    ]);
    expect(reply().tools).toEqual(['get_overview', 'search_purchase_requests']);

    await server.reply(1, { type: 'text', text: '12 are pending.' }, turn([textBlock('12 are pending.')]));
    await done;

    // Text after the tool call starts a new paragraph.
    expect(reply()).toMatchObject({ text: 'Let me check.\n\n12 are pending.', status: 'done' });
  });

  it('only ever appends to the conversation it sends', async () => {
    const server = fakeServer();
    let done = service.send('First');
    await server.reply(0, turn([toolUse('t1', 'get_overview')], 'tool_use'));
    await server.reply(1, turn([textBlock('Answer')]));
    await done;

    done = service.send('Second');
    await server.reply(2, turn([textBlock('Again')]));
    await done;

    const [a, b, c] = [0, 1, 2].map((n) => server.request(n).messages);
    expect(b.slice(0, a.length)).toEqual(a);
    expect(c.slice(0, b.length)).toEqual(b);
    expect(c.length).toBe(b.length + 2); // + Claude's answer + the new question
  });

  it('gives up after too many tool rounds', async () => {
    const server = fakeServer();
    const done = service.send('Loop');
    for (let n = 0; n <= CHAT_LIMITS.maxToolRounds; n++) {
      await server.reply(n, turn([toolUse(`t${n}`, 'get_overview')], 'tool_use'));
    }
    await done;
    expect(server.fetchMock).toHaveBeenCalledTimes(CHAT_LIMITS.maxToolRounds + 1);
    expect(reply()).toMatchObject({ status: 'error', error: 'failed' });
  });

  it('ignores blank messages and messages sent while a reply is streaming', async () => {
    const server = fakeServer();
    await service.send('   ');
    expect(service.messages()).toEqual([]);

    const first = service.send('First');
    await service.send('Second');
    expect(service.messages().map((m) => m.text)).toEqual(['First', '']);
    expect(server.fetchMock).toHaveBeenCalledTimes(1);

    await server.reply(0, turn([]));
    await first;
  });

  it('stop() aborts the request, keeps the text so far, and tells Claude what it had said', async () => {
    const server = fakeServer();
    let done = service.send('Hello');
    await server.reply(0, { type: 'text', text: 'Hi there' });
    await vi.waitFor(() => expect(reply().text).toBe('Hi there'));

    service.stop();
    await done;
    expect(reply()).toMatchObject({ status: 'stopped', text: 'Hi there' });
    expect(server.fetchMock.mock.calls[0][1].signal!.aborted).toBe(true);
    expect(service.busy()).toBe(false);

    done = service.send('Go on');
    expect(server.request(1).messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'user', content: 'Go on' },
    ]);
    await server.reply(1, turn([]));
    await done;
  });

  it('clear() stops the reply and starts a new conversation', async () => {
    const server = fakeServer();
    let done = service.send('Hello');
    service.clear();
    await done;
    expect(service.messages()).toEqual([]);
    expect(service.busy()).toBe(false);

    done = service.send('Fresh start');
    expect(server.request(1).messages).toEqual([{ role: 'user', content: 'Fresh start' }]);
    await server.reply(1, turn([]));
    await done;
  });

  describe('history', () => {
    /** A new ChatService, as after a page refresh. */
    function reload(): ChatService {
      TestBed.resetTestingModule();
      return TestBed.inject(ChatService);
    }

    it('survives a page refresh, messages and conversation both', async () => {
      const server = fakeServer();
      const done = service.send('Hello');
      await server.reply(0, { type: 'text', text: 'Hi!' }, turn([textBlock('Hi!')]));
      await done;

      const fresh = reload();
      expect(fresh.messages()).toEqual(service.messages());

      // The restored conversation carries on, and new messages get new ids.
      const next = fresh.send('Again');
      expect(server.request(1).messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: [textBlock('Hi!')] },
        { role: 'user', content: 'Again' },
      ]);
      expect(new Set(fresh.messages().map((m) => m.id)).size).toBe(4);
      await server.reply(1, turn([]));
      await next;
    });

    it('clear() forgets the saved conversation', async () => {
      const server = fakeServer();
      const done = service.send('Hello');
      await server.reply(0, turn([textBlock('Hi!')]));
      await done;

      service.clear();
      expect(reload().messages()).toEqual([]);
    });

    it('ignores saved data it can\'t read', () => {
      sessionStorage.setItem('fs-chat', '{not json');
      expect(reload().messages()).toEqual([]);
      sessionStorage.setItem('fs-chat', '{"messages":"nope"}');
      expect(reload().messages()).toEqual([]);
    });

    it('a reply saved mid-stream comes back as stopped', () => {
      const messages = [{ id: 1, role: 'assistant', text: 'Part', status: 'streaming' }];
      sessionStorage.setItem('fs-chat', JSON.stringify({ messages, transcript: [] }));
      expect(reload().messages()[0].status).toBe('stopped');
    });
  });

  describe('retry()', () => {
    it('asks again from where the conversation ended, without repeating the question', async () => {
      const server = fakeServer();
      let done = service.send('Hello');
      await server.reply(0, { type: 'text', text: 'Hal' }, { type: 'error', code: 'busy' });
      await done;
      expect(service.canRetry()).toBe(true);

      done = service.retry();
      expect(reply()).toMatchObject({ text: '', status: 'streaming' });
      expect(reply().error).toBeUndefined();
      expect(server.request(1)).toEqual(server.request(0));

      await server.reply(1, { type: 'text', text: 'Hi!' }, turn([textBlock('Hi!')]));
      await done;
      expect(service.messages().length).toBe(2);
      expect(reply()).toMatchObject({ text: 'Hi!', status: 'done' });
      expect(service.canRetry()).toBe(false);
    });

    it('is not offered when asking again can\'t help', async () => {
      fakeServer().reply(0, { type: 'error', code: 'refusal' });
      await service.send('Hello');
      expect(service.canRetry()).toBe(false);

      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 503 }))));
      await service.send('Again');
      expect(service.canRetry()).toBe(false);
    });
  });

  describe('errors', () => {
    async function replyAfter(respond: (server: ReturnType<typeof fakeServer>) => Promise<void>) {
      const server = fakeServer();
      const done = service.send('Hello');
      await respond(server);
      await done;
      return reply();
    }

    it('an error event marks the reply as failed, keeping its text', async () => {
      const r = await replyAfter((s) => s.reply(0, { type: 'text', text: 'Part' }, { type: 'error', code: 'busy' }));
      expect(r).toMatchObject({ status: 'error', error: 'busy', text: 'Part' });
    });

    it('a refusal is reported as such', async () => {
      expect((await replyAfter((s) => s.reply(0, { type: 'error', code: 'refusal' }))).error).toBe('refusal');
    });

    it('a stream that ends without Claude\'s turn counts as failed', async () => {
      const r = await replyAfter(async (s) => {
        await s.reply(0, { type: 'text', text: 'Cut' });
        await s.end(0);
      });
      expect(r).toMatchObject({ status: 'error', error: 'failed' });
    });

    it.each([
      [429, 'rateLimited'],
      [503, 'unavailable'],
      [413, 'tooLong'],
      [500, 'failed'],
    ])('HTTP %i is shown as "%s"', async (status, error) => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status }))));
      await service.send('Hello');
      expect(reply()).toMatchObject({ status: 'error', error });
    });

    it('a network failure is shown as "failed"', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
      await service.send('Hello');
      expect(reply()).toMatchObject({ status: 'error', error: 'failed' });
    });
  });
});
