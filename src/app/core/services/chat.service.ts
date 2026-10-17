import { Service, computed, inject, signal } from '@angular/core';
import { ApiMessage, CHAT_LIMITS, ChatErrorCode, ChatEvent, ChatRequest } from '../models/chat.model';
import { ChatToolName } from '../models/chat-tools';
import { ChatToolsService } from './chat-tools.service';

/** Who wrote a message: the user or Claude. */
export type ChatRole = 'user' | 'assistant';

/** `streaming` while the reply is still arriving; `stopped` when the user pressed Stop. */
export type ChatStatus = 'done' | 'streaming' | 'stopped' | 'error';

/**
 * Why a reply failed, shown as `chat.errors.<kind>`: the server's codes
 * (refusal, busy, tooLong, failed), plus
 *  - rateLimited: this visitor sent too many messages
 *  - unavailable: the server has no API key
 */
export type ChatErrorKind = ChatErrorCode | 'rateLimited' | 'unavailable';

export interface ChatMessage {
  id: number;
  role: ChatRole;
  text: string;
  status: ChatStatus;
  error?: ChatErrorKind;
  /** Tools the assistant used for this reply, in order, shown above the text. */
  tools?: ChatToolName[];
}

/** Claude's complete message for one request, as sent by the server. */
type Turn = Extract<ChatEvent, { type: 'turn' }>;

/** Failures that may succeed if asked again (unlike a refusal or a missing API key). */
const RETRYABLE: readonly ChatErrorKind[] = ['failed', 'busy', 'rateLimited'];

/** sessionStorage key: the conversation lasts as long as the tab, like the session's data. */
const STORAGE_KEY = 'fs-chat';

interface SavedChat {
  messages: ChatMessage[];
  transcript: ApiMessage[];
}

/** The Node server's chat endpoint (proxied to localhost:3000 by `ng serve`). */
export const CHAT_URL = '/api/chat';

/** An error whose `kind` is shown to the user (see chat.errors.* in the translations). */
class ChatError extends Error {
  constructor(readonly kind: ChatErrorKind) {
    super(kind);
  }
}

/**
 * ChatService
 * -----------
 * State of the AI assistant panel: open / closed, the conversation, and the
 * reply that is streaming in. ChatPanelComponent renders it; the navbar's
 * chat button toggles it.
 *
 * Two views of the conversation are kept:
 *  - `messages`: what the panel shows (one bubble per question and answer);
 *  - `transcript`: the Claude conversation, with every tool call, tool
 *    result and reasoning block, sent to the server on each request.
 * The transcript is append-only: Claude's reasoning blocks are tied to the
 * exact conversation that produced them, so earlier turns are never edited
 * or trimmed. A conversation past CHAT_LIMITS.maxMessages has to start over.
 * Both are kept in sessionStorage after each reply, so the chat survives a
 * page refresh but ends with the tab, like the session's data.
 *
 * One question can take several requests: when Claude asks for tools, they
 * run here, on this session's data (ChatToolsService), and the results go
 * back in the next request. fetch() is used rather than HttpClient because it
 * hands over the response body as a stream. Stop aborts the fetch; the server
 * then cancels the Claude request too.
 */
@Service()
export class ChatService {
  private readonly tools = inject(ChatToolsService);
  /** The conversation restored from sessionStorage (empty on a fresh tab). */
  private readonly saved = restore();
  /** Next message id; starts after the highest restored id so ids stay unique. */
  private nextId = Math.max(0, ...this.saved.messages.map((m) => m.id)) + 1;
  /** Controller for the request in progress; aborting it is what Stop does. */
  private abort: AbortController | null = null;
  private transcript: ApiMessage[] = this.saved.transcript;

  /** Whether the chat panel is visible. */
  readonly isOpen = signal(false);

  private readonly _messages = signal<ChatMessage[]>(this.saved.messages);
  /** The messages the panel shows, read-only for the components. */
  readonly messages = this._messages.asReadonly();

  /** True while a reply is streaming; sending is blocked until it ends. */
  readonly busy = computed(() => this._messages().some((m) => m.status === 'streaming'));

  /** The last reply failed for a reason worth trying again (see retry()). */
  readonly canRetry = computed(() => {
    const last = this._messages().at(-1);
    return last?.status === 'error' && RETRYABLE.includes(last.error!);
  });

  /** Opens the panel if it is closed, closes it if it is open. */
  toggle(): void {
    this.isOpen.update((o) => !o);
  }

  /** Hides the panel; the conversation is kept. */
  close(): void {
    this.isOpen.set(false);
  }

  /** Adds the user's message, then streams the assistant's reply into a new message. */
  async send(text: string): Promise<void> {
    const prompt = text.trim();
    if (!prompt || this.busy()) return;

    this.add('user', prompt, 'done');
    const replyId = this.add('assistant', '', 'streaming');
    this.transcript.push({ role: 'user', content: prompt });
    await this.respond(replyId);
  }

  /**
   * Asks again after a failed reply. The conversation already ends with what
   * Claude hasn't answered yet (the question, or tool results), so this just
   * continues from there; nothing is added or removed.
   */
  async retry(): Promise<void> {
    const last = this._messages().at(-1);
    if (!last || !this.canRetry() || this.busy()) return;
    this.patch(last.id, (m) => ({ ...m, text: '', status: 'streaming', error: undefined }));
    await this.respond(last.id);
  }

  /** Gets Claude's answer to the end of the conversation, running tools as asked, into message `replyId`. */
  private async respond(replyId: number): Promise<void> {
    const abort = (this.abort = new AbortController());
    const transcript = this.transcript;

    /** Text of the request in progress, kept if the user presses Stop. */
    let partial = '';
    const write = (chunk: string) => {
      partial += chunk;
      this.patch(replyId, (m) => ({ ...m, text: m.text + chunk }));
    };

    try {
      for (let round = 0; ; round++) {
        if (round > CHAT_LIMITS.maxToolRounds) throw new ChatError('failed');
        if (transcript.length >= CHAT_LIMITS.maxMessages) throw new ChatError('tooLong');

        partial = '';
        const needsBreak = this.message(replyId)?.text !== '';
        const turn = await this.streamTurn(transcript, abort.signal, (chunk) => {
          // Text after a tool call starts a new paragraph.
          write(needsBreak && !partial ? `\n\n${chunk}` : chunk);
        });
        transcript.push({ role: 'assistant', content: turn.content });
        if (turn.stopReason !== 'tool_use') break;
        transcript.push({ role: 'user', content: this.runTools(turn, replyId) });
      }
      this.patch(replyId, (m) => ({ ...m, status: 'done' }));
    } catch (err) {
      if (abort.signal.aborted) {
        // Tell Claude what it had said before it was stopped.
        if (partial.trim() && transcript === this.transcript) transcript.push({ role: 'assistant', content: partial });
        this.patch(replyId, (m) => ({ ...m, status: 'stopped' }));
      } else {
        const error = err instanceof ChatError ? err.kind : 'failed';
        this.patch(replyId, (m) => ({ ...m, status: 'error', error }));
      }
    } finally {
      if (this.abort === abort) this.abort = null;
      // Unless the conversation was cleared meanwhile.
      if (transcript === this.transcript) this.save();
    }
  }

  /** Stops the reply that is streaming; the text so far is kept. */
  stop(): void {
    this.abort?.abort();
  }

  /** Starts a new conversation. */
  clear(): void {
    this.stop();
    this._messages.set([]);
    this.transcript = [];
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  /** Keeps the conversation for this tab, so it survives a page refresh. */
  private save(): void {
    const data: SavedChat = { messages: this._messages(), transcript: this.transcript };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or unavailable: the chat still works, it just isn't kept */
    }
  }

  /** Runs every tool call in Claude's turn; the results go back together in one message. */
  private runTools(turn: Turn, replyId: number): ApiMessage['content'] {
    const results: Exclude<ApiMessage['content'], string> = [];
    for (const block of turn.content) {
      if (block.type !== 'tool_use') continue;
      const name = block.name as ChatToolName;
      this.patch(replyId, (m) => ({ ...m, tools: m.tools?.includes(name) ? m.tools : [...(m.tools ?? []), name] }));
      const outcome = this.tools.run(block.name, block.input);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: outcome.content, is_error: outcome.isError });
    }
    return results;
  }

  /** POSTs the conversation, passes text chunks to `onText` as they arrive, and returns Claude's turn. */
  private async streamTurn(messages: ApiMessage[], signal: AbortSignal, onText: (chunk: string) => void): Promise<Turn> {
    const request: ChatRequest = { messages };
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok || !response.body) throw new ChatError(httpErrorKind(response.status));

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop()!; // the last line may be incomplete
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === 'text') onText(event.text);
        else if (event.type === 'error') throw new ChatError(event.code);
        else return event;
      }
    }
    // The connection closed before Claude's turn arrived.
    throw new ChatError('failed');
  }

  /** Looks up a message by id. */
  private message(id: number): ChatMessage | undefined {
    return this._messages().find((m) => m.id === id);
  }

  /** Appends a message to the panel and returns its id. */
  private add(role: ChatRole, text: string, status: ChatStatus): number {
    const id = this.nextId++;
    this._messages.update((list) => [...list, { id, role, text, status }]);
    return id;
  }

  /** Updates one message; does nothing if it was cleared meanwhile. */
  private patch(id: number, change: (m: ChatMessage) => ChatMessage): void {
    this._messages.update((list) => list.map((m) => (m.id === id ? change(m) : m)));
  }
}

/** The saved conversation from earlier in this tab, or an empty one. */
function restore(): SavedChat {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SavedChat> | null;
    if (Array.isArray(data?.messages) && Array.isArray(data.transcript)) {
      // A reply can't still be streaming after a reload.
      const messages = data.messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m));
      return { messages, transcript: data.transcript };
    }
  } catch {
    /* unreadable: start fresh */
  }
  return { messages: [], transcript: [] };
}

function httpErrorKind(status: number): ChatErrorKind {
  if (status === 429) return 'rateLimited';
  if (status === 503) return 'unavailable';
  if (status === 413) return 'tooLong';
  return 'failed';
}
