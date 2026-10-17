import { Component, inject } from '@angular/core';
import { ChatService } from '../../../core/services/chat.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CHAT_TOGGLE_ID } from '../chat-panel/chat-panel.component';

/**
 * ChatFabComponent
 * ----------------
 * The AI assistant's floating button, fixed to the bottom-right corner of
 * every signed-in page (the inline-end corner in Arabic). It opens and closes
 * the chat panel, which floats just above it. While the panel is open the
 * icon turns into a close icon.
 */
@Component({
  selector: 'app-chat-fab',
  imports: [TranslatePipe, IconComponent],
  templateUrl: './chat-fab.component.html',
  styleUrl: './chat-fab.component.scss',
})
export class ChatFabComponent {
  protected readonly chat = inject(ChatService);
  protected readonly toggleId = CHAT_TOGGLE_ID;

  protected toggle(): void {
    this.chat.toggle();
  }
}
