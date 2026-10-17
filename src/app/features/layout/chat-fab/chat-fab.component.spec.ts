import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatService } from '../../../core/services/chat.service';
import { ChatFabComponent } from './chat-fab.component';

describe('ChatFabComponent', () => {
  let fixture: ComponentFixture<ChatFabComponent>;
  let el: HTMLElement;
  let chat: ChatService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ChatFabComponent] }).compileComponents();
    fixture = TestBed.createComponent(ChatFabComponent);
    el = fixture.nativeElement;
    chat = TestBed.inject(ChatService);
    await fixture.whenStable();
  });

  afterEach(() => chat.clear());

  const button = () => el.querySelector<HTMLButtonElement>('button.chat-fab')!;

  it('is a labelled button that controls the chat panel', () => {
    expect(button().getAttribute('aria-controls')).toBe('chat-panel');
    expect(button().getAttribute('aria-haspopup')).toBe('dialog');
    expect(button().getAttribute('aria-label')).toBe('Finance assistant');
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });

  it('a click opens and closes the assistant, and the button shows the state', async () => {
    button().click();
    await fixture.whenStable();
    expect(chat.isOpen()).toBe(true);
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().classList).toContain('is-open');

    button().click();
    await fixture.whenStable();
    expect(chat.isOpen()).toBe(false);
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });
});
