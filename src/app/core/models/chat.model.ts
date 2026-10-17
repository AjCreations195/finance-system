import type Anthropic from '@anthropic-ai/sdk';

/**
 * Wire format between the chat panel and the Node server (server/chat.ts).
 * Shared by both sides. The server runs this file with Node's TypeScript type
 * stripping, so keep to syntax Node can strip: no enums, namespaces or
 * Angular imports, and only `import type` from other files.
 *
 * The browser keeps the whole Claude conversation (ApiMessage[]) and POSTs it
 * to /api/chat. The server streams back one ChatEvent per line (NDJSON):
 * `text` chunks as Claude writes them, then `turn` with Claude's complete
 * message, or `error`. When the turn ends in tool calls, the browser runs the
 * tools on its own data (chat-tools.service.ts), appends the results and
 * POSTs again, until Claude has its answer.
 */

/** One message of the Claude conversation, exactly as the API expects it. */
export type ApiMessage = Anthropic.Beta.BetaMessageParam;

export interface ChatRequest {
  /** The conversation so far, oldest first, ending with a user message. */
  messages: ApiMessage[];
}

/**
 * Why a reply failed:
 *  - refusal: Claude declined to answer
 *  - busy: the AI service is overloaded or rate limited
 *  - tooLong: the conversation passed CHAT_LIMITS.maxMessages
 *  - failed: anything else
 */
export type ChatErrorCode = 'refusal' | 'busy' | 'tooLong' | 'failed';

export type ChatEvent =
  | { type: 'text'; text: string }
  /** Claude's complete message: append it to the conversation unchanged. */
  | { type: 'turn'; content: Anthropic.Beta.BetaContentBlock[]; stopReason: Anthropic.Beta.BetaStopReason | null }
  | { type: 'error'; code: ChatErrorCode };

/** Limits the server enforces; the panel uses the same ones. */
export const CHAT_LIMITS = {
  /** Longest message the user can type, in characters. */
  maxChars: 2000,
  /**
   * Longest conversation, in API messages (a question with tool calls takes
   * several). The history is never trimmed, because Claude's reasoning blocks
   * are tied to the exact conversation; past this the user starts a new one.
   */
  maxMessages: 80,
  /** Most tool-call rounds for one question. */
  maxToolRounds: 6,
} as const;
