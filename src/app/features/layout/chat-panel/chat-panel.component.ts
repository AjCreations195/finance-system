import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, ElementRef, Injector, afterNextRender, effect, inject, signal, viewChild } from '@angular/core';
import { CHAT_LIMITS } from '../../../core/models/chat.model';
import { ChatToolName } from '../../../core/models/chat-tools';
import { ChatService } from '../../../core/services/chat.service';
import { LanguageService } from '../../../core/services/language.service';
import { PurchaseRequestService } from '../../../core/services/purchase-request.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkspaceTabsService } from '../../../core/services/workspace-tabs.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ChatFormatPipe } from './chat-format';

/** Starter questions shown in an empty conversation (translation keys). */
const SUGGESTIONS = ['chat.suggestions.pending', 'chat.suggestions.topSpend', 'chat.suggestions.summary'];

/** Icon beside each tool the assistant used. */
const TOOL_ICONS: Record<ChatToolName, string> = {
  get_overview: 'speed',
  search_purchase_requests: 'search',
  get_purchase_request: 'file-text',
  spending_breakdown: 'chart',
  open_purchase_request: 'external-link',
};

/** The floating chat button that opens the panel; focus returns to it on close. */
export const CHAT_TOGGLE_ID = 'chat-toggle';

/**
 * ChatPanelComponent
 * ------------------
 * The AI assistant: a card that rises above the floating chat button in the
 * bottom-right corner (bottom-left in Arabic). On phones it covers the whole
 * screen below the navbar.
 *
 *   [✦ Finance assistant          🗑 ✕]
 *   [ starter questions / messages   ]
 *   [ textarea                    ➤ ]
 *
 * Enter sends, Shift+Enter adds a line, Esc closes. While a reply streams the
 * send button becomes Stop. Replies show simple formatting (chat-format.ts),
 * request numbers in them open the request, and each answer can be copied;
 * a failed reply can be tried again. It's a non-modal dialog: the page stays usable,
 * so focus isn't trapped, but it moves into the panel on open and back to
 * the chat button on close.
 */
@Component({
  selector: 'app-chat-panel',
  imports: [TranslatePipe, IconComponent, ChatFormatPipe, NgTemplateOutlet],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class ChatPanelComponent {
  protected readonly chat = inject(ChatService);
  private readonly language = inject(LanguageService);
  private readonly requests = inject(PurchaseRequestService);
  private readonly workspace = inject(WorkspaceTabsService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly suggestions = SUGGESTIONS;
  protected readonly maxChars = CHAT_LIMITS.maxChars;
  protected readonly toolIcons = TOOL_ICONS;
  protected readonly draft = signal('');

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // Focus the textarea each time the panel opens.
    effect(() => {
      if (this.chat.isOpen()) afterNextRender(() => this.input()?.nativeElement.focus(), { injector: this.injector });
    });

    // Keep the newest message in view as replies stream in.
    effect(() => {
      this.chat.messages();
      afterNextRender(
        () => {
          const log = this.log()?.nativeElement;
          if (log) log.scrollTop = log.scrollHeight;
        },
        { injector: this.injector },
      );
    });
  }

  protected send(text = this.draft()): void {
    if (!text.trim() || this.chat.busy()) return;
    void this.chat.send(text);
    this.draft.set('');
    this.input()?.nativeElement.focus();
  }

  /** A starter question is sent as-is, in the current language. */
  protected sendSuggestion(key: string): void {
    this.send(this.language.translate(key));
  }

  /** Enter sends; Shift+Enter (and Enter while composing Arabic/IME text) adds a line. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.send();
  }

  protected close(): void {
    if (!this.chat.isOpen()) return;
    this.chat.close();
    this.document.getElementById(CHAT_TOGGLE_ID)?.focus();
  }

  /**
   * A request number in a reply was clicked: open its details panel. Below
   * lg the chat covers the page, so it closes to show the request.
   */
  protected openRequest(number: string): void {
    const request = this.requests.requests().find((r) => r.number === number);
    if (!request) {
      this.toast.show(this.language.translate('chat.requestMissing', { number }), 'warning');
      return;
    }
    this.workspace.openRequest(request.id);
    if (!this.document.defaultView?.matchMedia('(min-width: 992px)').matches) this.chat.close();
  }

  protected copy(text: string): void {
    const fail = () => this.toast.show(this.language.translate('requests.details.copyFailed'), 'danger');
    if (!navigator.clipboard) {
      fail();
      return;
    }
    navigator.clipboard.writeText(text).then(() => this.toast.show(this.language.translate('chat.copied'), 'success'), fail);
  }
}
