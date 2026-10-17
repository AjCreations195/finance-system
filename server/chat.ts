import Anthropic from '@anthropic-ai/sdk';
import type { Request, Response } from 'express';
import { CHAT_LIMITS } from '../src/app/core/models/chat.model.ts';
import type { ApiMessage, ChatErrorCode, ChatEvent } from '../src/app/core/models/chat.model.ts';
import { CHAT_TOOLS } from '../src/app/core/models/chat-tools.ts';

/** Used when CLAUDE_MODEL isn't set. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

/**
 * Models that accept `fallbacks: "default"`: if a safety check wrongly
 * declines a question, the API retries it on a suitable fallback model.
 * Others (e.g. claude-haiku-5-5) may reject the parameter, so it's left out.
 */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1']);

/**
 * Caps each reply's length (and so its cost) on a public demo. A chat answer
 * is a few paragraphs; this leaves room for Claude's thinking as well.
 */
const MAX_TOKENS = 4096;

/** The parts of the SDK client the chat route uses (tests pass a fake). */
export type ChatClient = Pick<Anthropic, 'beta'>;

export type ParsedChatRequest = { messages: ApiMessage[] } | { error: string; status: 400 | 413 };

/**
 * Checks the shape of the conversation. Messages are passed to Claude exactly
 * as received: Claude's reasoning blocks are tied to the conversation, so the
 * server must not trim or rewrite earlier turns.
 */
export function parseChatRequest(body: unknown): ParsedChatRequest {
  const bad = (error: string) => ({ error, status: 400 as const });
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || !messages.length) return bad('messages must be a non-empty array');
  if (messages.length > CHAT_LIMITS.maxMessages) return { error: 'too_long', status: 413 };

  for (const m of messages as Partial<ApiMessage>[]) {
    if (m?.role !== 'user' && m?.role !== 'assistant') return bad('each message needs role "user" or "assistant"');
    const { content } = m;
    const valid =
      typeof content === 'string'
        ? content.trim() !== ''
        : Array.isArray(content) && content.length > 0 && content.every((b) => typeof b?.type === 'string');
    if (!valid) return bad('each message needs text or content blocks');
  }

  const first = messages[0] as ApiMessage;
  const last = messages.at(-1) as ApiMessage;
  if (first.role !== 'user' || last.role !== 'user') return bad('the conversation must start and end with a user message');
  if (typedText(last).length > CHAT_LIMITS.maxChars) return bad(`messages are limited to ${CHAT_LIMITS.maxChars} characters`);

  return { messages: messages as ApiMessage[] };
}

/** The text the user typed in a message (tool results don't count). */
function typedText(message: ApiMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

/**
 * The same for every request: changing it mid-conversation would invalidate
 * Claude's earlier reasoning and the prompt cache. Anything that changes
 * (today's date, the data) comes from tools instead.
 */
const SYSTEM_PROMPT = `You are the Finance assistant inside the Financial System of the Systems Development Department, Ministry of Interior, State of Qatar. Staff use it for purchase requests, procurement, budgets, custody, warehouses, contracts and invoices.

You can look up the user's purchase requests with your tools. The tools read the same data the user sees on screen, including changes they made in this session (approvals, rejections, deletions).

How to work:
- For any question about requests, amounts, budgets or spending, call the tools; never guess or invent figures, request numbers or names. If the tools can't answer it, say so.
- Answer first in one or two sentences, then add detail only if it helps.
- Write request numbers in full, e.g. BDRS/2016/019/0042: the chat turns them into links that open the request.
- Amounts are in Qatari riyals (QAR); write them with thousands separators, e.g. 125,000 QAR.
- The data is demo data. get_overview reports the dates it covers, so don't state them from memory. Unless the user gives dates, read "this month" as the latest month in the data and "this year" as the latest year in the data (get_overview reports both), and say which month or year you used.

Request statuses: accepted, inProgress, finished, forReview, sent, rejected, pending, completed, inCorrection (returned to the creator for changes), suspended, verified, notExecutable, closed, delivered.
Stages group them as on the purchase requests page:
- fullyCompleted: accepted, completed, finished, closed, delivered
- partiallyCompleted: verified, suspended
- inProgress: inProgress, forReview, sent, pending, inCorrection
- rejected: rejected, notExecutable
"Waiting for approval" means the inProgress stage. Use the user's words for statuses (e.g. "in review" for forReview), not the code names.

Formatting: the chat shows paragraphs, "-" bullet lists, "1." numbered lists and **bold**. Use bold sparingly, for the key figure. Don't use headings, tables, links or code blocks; they would show as raw symbols.

Reply in the language the user writes in (Arabic or English).

Latency-sensitive; begin your visible answer immediately.`;

/**
 * POST /api/chat
 * Streams one Claude turn as NDJSON ChatEvents: text as it is written, then
 * the complete message (`turn`), which the browser appends to its copy of the
 * conversation. If the turn ends in tool calls the browser runs them and
 * calls this again. If the browser disconnects (Stop, or the page closed) the
 * Claude request is aborted, so no more tokens are spent on it.
 */
export function chatHandler(client: ChatClient, model = DEFAULT_MODEL) {
  const fallback = FALLBACK_MODELS.has(model);

  return async (req: Request, res: Response): Promise<void> => {
    const parsed = parseChatRequest(req.body);
    if ('error' in parsed) {
      res.status(parsed.status).json({ error: parsed.error });
      return;
    }

    res.status(200).set({
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no', // don't let a proxy hold the stream back
    });
    res.flushHeaders();
    const send = (event: ChatEvent) => res.write(JSON.stringify(event) + '\n');

    const stream = client.beta.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: CHAT_TOOLS,
      messages: parsed.messages,
      // Caches the system prompt, tools and conversation so far: each tool
      // round re-sends them, and cached input costs a fraction of the price.
      cache_control: { type: 'ephemeral' },
      // Medium effort: Opus reasons enough to get the figures and statuses right
      // across several tool calls. Lower it to 'low' to trade quality for speed and cost.
      output_config: { effort: 'medium' },
      // If the conversation the browser sends back was altered, drop the
      // affected reasoning blocks instead of failing the request.
      thinking: { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
      ...(fallback && { fallbacks: 'default' as const }),
      betas: [...(fallback ? ['server-side-fallback-2026-07-01'] : []), 'thinking-binding-controls-2026-08-01'],
    });

    let disconnected = false;
    res.on('close', () => {
      if (res.writableFinished) return;
      disconnected = true;
      stream.abort();
    });

    try {
      let wroteText = false;
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'text' && wroteText) {
          send({ type: 'text', text: '\n\n' }); // separate text written before and after a tool call
        } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          send({ type: 'text', text: event.delta.text });
          wroteText = true;
        }
      }
      const message = await stream.finalMessage();
      const hasToolUse = message.content.some((b) => b.type === 'tool_use');
      if (message.stop_reason === 'refusal') {
        send({ type: 'error', code: 'refusal' });
      } else if (message.stop_reason === 'max_tokens' && hasToolUse) {
        // The last tool call's input may be cut off; don't let the browser run it.
        send({ type: 'error', code: 'failed' });
      } else {
        send({ type: 'turn', content: message.content, stopReason: message.stop_reason });
      }
    } catch (err) {
      if (disconnected) return;
      console.error('[chat] Claude API error:', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
      send({ type: 'error', code: errorCode(err) });
    }
    res.end();
  };
}

function errorCode(err: unknown): ChatErrorCode {
  if (err instanceof Anthropic.RateLimitError) return 'busy';
  if (err instanceof Anthropic.APIError && (err.status === 529 || (err.status ?? 0) >= 500)) return 'busy';
  return 'failed';
}
