import { Component, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import ApexCharts from 'apexcharts';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeService } from '../../../core/services/theme.service';

/** Chart colors for each theme. Kept in sync with the tokens in styles.scss. */
const CHART_THEME = {
  light: { text: '#6b7385', grid: '#e5e8f0' },
  dark: { text: '#a8a3a3', grid: '#353333' },
} as const;

/** Height reserved before the chart draws, so the page doesn't jump when it appears. */
const DEFAULT_HEIGHT = 300;

/**
 * ChartComponent
 * --------------
 * Small Angular wrapper around ApexCharts (instead of ng-apexcharts,
 * so we don't depend on a third-party wrapper keeping up with Angular releases).
 *
 * Responsibilities:
 *  - Waits until the chart scrolls into view, then creates it, so the
 *    entrance animation plays where the reader is looking.
 *  - Merges theme- and language-aware defaults into the given options,
 *    so every chart switches to dark mode / Arabic font automatically.
 *  - Animates the entrance (eased sweep, series one after another) and data
 *    changes; turns animation off when the user prefers reduced motion.
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
  host: {
    dir: 'ltr',
    class: 'd-block',
    '[style.min-height.px]': 'reservedHeight()',
  },
})
export class ChartComponent {
  /** ApexCharts configuration from the parent component. */
  readonly options = input.required<ApexCharts.ApexOptions>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly reduceMotion = prefersReducedMotion();
  private chart?: ApexCharts;
  /** Last data drawn, so language/theme-only updates don't replay the animation. */
  private lastSeries = '';
  /** False until the chart has scrolled into view; the chart is created then. */
  private readonly visible = signal(false);

  protected readonly reservedHeight = computed(() => {
    const height = this.options().chart?.height;
    return typeof height === 'number' ? height : DEFAULT_HEIGHT;
  });

  /** Parent options combined with theme, language and animation defaults. */
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
        animations: {
          enabled: !this.reduceMotion,
          easing: 'easeout',
          speed: 900,
          animateGradually: { enabled: true, delay: 150 },
          dynamicAnimation: { enabled: !this.reduceMotion, speed: 500 },
          ...opts.chart?.animations,
        },
      },
      theme: { ...opts.theme, mode },
      grid: { borderColor: colors.grid, strokeDashArray: 4, ...opts.grid },
      tooltip: { ...opts.tooltip, theme: mode },
    };
  });

  constructor() {
    // Start drawing once the chart is at least partly on screen (or straight away
    // where IntersectionObserver is missing, e.g. in tests).
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.visible.set(true);
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            this.visible.set(true);
            observer.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      observer.observe(this.elementRef.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Runs after Angular renders, and again whenever mergedOptions changes.
    afterRenderEffect(() => {
      if (!this.visible()) return;
      const options = this.mergedOptions();
      const series = JSON.stringify(options.series);
      if (!this.chart) {
        this.chart = new ApexCharts(this.host().nativeElement, options);
        this.lastSeries = series;
        void this.chart.render();
      } else {
        // Animate only when the numbers change. A language or theme switch
        // updates labels, fonts and colors in place, without replaying the sweep.
        const dataChanged = series !== this.lastSeries;
        this.lastSeries = series;
        // redrawPaths=false: no full redraw; animate only on data change
        void this.chart.updateOptions(options, false, dataChanged);
      }
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }
}

/** True when the OS asks for less motion (also covered by the global CSS rule). */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
