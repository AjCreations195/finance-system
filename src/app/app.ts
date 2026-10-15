import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

/**
 * Root component: renders the active route plus the global toast area.
 * ThemeService and LanguageService are injected here so their effects
 * (data-bs-theme, dir, lang) are active from the first render, on every page.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  template: `
    <router-outlet />
    <app-toast-container />
  `,
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
}
