import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatService } from '../../../core/services/chat.service';
import { ChatToolsService } from '../../../core/services/chat-tools.service';
import { ChatPanelComponent, CHAT_TOGGLE_ID } from './chat-panel.component';

describe('ChatPanelComponent', () => {
  let fixture: ComponentFixture<ChatPanelComponent>;
  let el: HTMLElement;
  let chat: ChatService;

  /** The server's reply: a stream that stays open until aborted. */
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.clear();
    fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const body = new ReadableStream({
        start(c) {
          init.signal?.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.configureTestingModule({ imports: [ChatPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(ChatPanelComponent);
    el = fixture.nativeElement;
    chat = TestBed.inject(ChatService);
    await fixture.whenStable();
  });

  afterEach(() => {
    chat.clear();
    vi.unstubAllGlobals();
  });

  const panel = () => el.querySelector('.chat-panel');
  const textarea = () => el.querySelector<HTMLTextAreaElement>('textarea')!;
  const sendBtn = () => el.querySelector<HTMLButtonElement>('.send-btn')!;

  async function open(): Promise<void> {
    chat.isOpen.set(true);
    await fixture.whenStable();
  }

  async function type(text: string): Promise<void> {
    textarea().value = text;
    textarea().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('renders nothing while closed', () => {
    expect(panel()).toBeNull();
  });

  it('opens as a labelled dialog with starter questions, and focuses the textarea', async () => {
    await open();
    expect(panel()!.getAttribute('role')).toBe('dialog');
    expect(panel()!.getAttribute('aria-labelledby')).toBe('chat-title');
    expect(el.querySelectorAll('.suggestion').length).toBe(3);
    expect(document.activeElement).toBe(textarea());
  });

  it('the send button is disabled until something is typed', async () => {
    await open();
    expect(sendBtn().disabled).toBe(true);
    await type('Hello');
    expect(sendBtn().disabled).toBe(false);
  });

  it('Enter sends the draft and clears the box; Shift+Enter does not send', async () => {
    await open();
    await type('Hello');

    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(chat.messages()).toEqual([]);

    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(chat.messages()[0]).toMatchObject({ role: 'user', text: 'Hello' });
    expect(textarea().value).toBe('');
    expect(el.querySelector('.msg.user .bubble')!.textContent).toBe('Hello');
  });

  it('a starter question is sent as the user message', async () => {
    await open();
    const suggestion = el.querySelector<HTMLButtonElement>('.suggestion')!;
    const text = suggestion.textContent!.trim();
    suggestion.click();
    await fixture.whenStable();
    expect(chat.messages()[0].text).toBe(text);
    expect(el.querySelector('.suggestion')).toBeNull();
  });

  it('shows a Stop button while the reply streams, which stops it', async () => {
    await open();
    await type('Hello');
    sendBtn().click();
    await fixture.whenStable();

    expect(sendBtn().getAttribute('aria-label')).toBe('Stop');
    sendBtn().click();
    await fixture.whenStable();
    expect(chat.messages()[1].status).toBe('stopped');
    expect(el.querySelector('.msg-note')!.textContent).toContain('Stopped');
  });

  it('lists the tools the assistant used above its answer', async () => {
    vi.spyOn(TestBed.inject(ChatToolsService), 'run').mockReturnValue({ content: '{}', isError: false });
    const toolTurn = { type: 'turn', stopReason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_overview', input: {} }] };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(toolTurn) + '\n', { status: 200 }));
    await open();
    void chat.send('Budget?');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await fixture.whenStable();
    const steps = el.querySelector('.tool-steps')!;
    expect(steps.getAttribute('aria-label')).toBe('Data the assistant checked');
    expect(steps.textContent).toContain('Checked the budget overview');
  });

  it('a failed reply shows the matching error message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    await open();
    await chat.send('Hello');
    await fixture.whenStable();

    const note = el.querySelector('.msg-note.error')!;
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('sent a lot of messages');
  });

  it('Esc closes the panel and returns focus to the chat button', async () => {
    const toggle = document.createElement('button');
    toggle.id = CHAT_TOGGLE_ID;
    document.body.appendChild(toggle);
    await open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(chat.isOpen()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(toggle);
    toggle.remove();
  });

  it('the close button closes the panel', async () => {
    await open();
    el.querySelector<HTMLButtonElement>('.header-btn[aria-label="Close"]')!.click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });
});
