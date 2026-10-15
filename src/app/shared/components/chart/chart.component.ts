import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, inject, input, viewChild } from '@angular/core';
import ApexCharts from 'apexcharts';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';

/** Chart colors for each theme. Kept in sync with the tokens in styles.scss. */
const CHART_THEME = {
  light: { text: '#6b7385', grid: '#e5e8f0' },
  dark: { text: '#98a1b6', grid: '#262f45' },
} as const;

/**
 * ChartComponent
 * --------------
 * Small Angular wrapper around ApexCharts (instead of ng-apexcharts,
 * so we don't depend on a third-party wrapper keeping up with Angular releases).
 *
 * Responsibilities:
 *  - Creates the chart after the first render (it needs a real DOM element).
 *  - Merges theme- and language-aware defaults into the given options,
 *    so every chart switches to dark mode / Arabic font automatically.
 *  - Updates the chart whenever the options, theme or language change.
 *  - Destroys the chart on component destroy to avoid memory leaks.
 *
 * Usage: <app-chart [options]="myOptions()" />
 */
@Component({
  selector: 'app-chart',
  template: `<div #host></div>`,
  // ApexCharts draws its own SVG layout and doesn't mirror for RTL, so the
  // chart area is kept LTR. Arabic labels still render correctly inside it.
  host: { dir: 'ltr', class: 'd-block' },
})
export class ChartComponent {
  /** ApexCharts configuration from the parent component. */
  readonly options = input.required<ApexCharts.ApexOptions>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private chart?: ApexCharts;

  /** Parent options combined with theme and language defaults. */
  private readonly mergedOptions = computed<ApexCharts.ApexOptions>(() => {
    const opts = this.options();
    const mode = this.theme.theme();
    const colors = CHART_THEME[mode];
    const fontFamily = this.language.lang() === 'ar' ? "'Lusail', 'IBM Plex Sans Arabic', sans-serif" : "'Lusail', 'DM Sans', sans-serif";

    return {
      ...opts,
      chart: {
        ...opts.chart,
        background: 'transparent',
        foreColor: colors.text,
        fontFamily,
        toolbar: { show: false },
      },
      theme: { ...opts.theme, mode },
      grid: { borderColor: colors.grid, strokeDashArray: 4, ...opts.grid },
      tooltip: { ...opts.tooltip, theme: mode },
    };
  });

  constructor() {
    // Runs after Angular renders, and again whenever mergedOptions changes.
    afterRenderEffect(() => {
      const options = this.mergedOptions();
      if (!this.chart) {
        this.chart = new ApexCharts(this.host().nativeElement, options);
        void this.chart.render();
      } else {
        // redrawPaths=false, animate=true: smooth transition, no full redraw
        void this.chart.updateOptions(options, false, true);
      }
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }
}
