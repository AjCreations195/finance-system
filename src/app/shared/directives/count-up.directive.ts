import { DestroyRef, Directive, ElementRef, afterNextRender, effect, inject, input, untracked } from '@angular/core';

/** Default text for a number: whole numbers, no separators. */
const formatInteger = (value: number): string => String(Math.round(value));

type Format = (value: number) => string;

/**
 * CountUpDirective
 * ----------------
 * Counts a number up (or down) to its value instead of showing it at once.
 *
 *  - The count starts when the element scrolls into view, so readers see it.
 *  - Later changes count from the value on screen to the new one.
 *  - `countUpFormat` turns the running number into text, e.g. "50 million riyals".
 *  - With reduced motion, or where animation frames are unavailable, the final value shows at once.
 *
 * Usage: <p [appCountUp]="amount" [countUpFormat]="format"></p>
 * The directive owns the element's text, so leave its content empty.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective {
  /** The number to show. */
  readonly appCountUp = input.required<number>();
  /** Turns the running number into text. Pass a stable function (an arrow property), not a method. */
  readonly countUpFormat = input<Format>(formatInteger);
  /** Length of the count in milliseconds. */
  readonly countUpDuration = input(900);

  /** The element whose text is written. */
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  /** True when the user asked for reduced motion; then the final value is shown at once. */
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Number currently on screen, so a change counts from there. */
  private shown = 0;
  /** True once the element has scrolled into view. */
  private visible = false;
  /** Latest request made while the element was still off screen. */
  private pending: { target: number; format: Format } | null = null;
  /** Id of the animation frame in progress, so it can be cancelled. */
  private frame = 0;

  constructor() {
    afterNextRender(() => this.watchVisibility());

    // Runs whenever the number or the format changes. Off screen it only draws zero,
    // so the final value never flashes before the count starts.
    effect(() => {
      const target = this.appCountUp();
      const format = this.countUpFormat();
      untracked(() => {
        if (this.visible) {
          this.countTo(target, format);
          return;
        }
        this.write(0, format);
        this.shown = 0;
        this.pending = { target, format };
      });
    });

    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
  }

  /** Starts the count once the element is half visible (or immediately where IntersectionObserver is missing). */
  private watchVisibility(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.show();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          this.show();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(this.element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** First time on screen: start the count from zero. */
  private show(): void {
    this.visible = true;
    if (this.pending) {
      this.countTo(this.pending.target, this.pending.format);
      this.pending = null;
    }
  }

  /** Counts from the number on screen to `target` over `countUpDuration` ms (or jumps there if animation is off). */
  private countTo(target: number, format: Format): void {
    cancelAnimationFrame(this.frame);
    const from = this.shown;
    const canAnimate = !this.reduceMotion && typeof requestAnimationFrame === 'function';

    if (!canAnimate || from === target) {
      this.shown = target;
      this.write(target, format);
      return;
    }

    const start = performance.now();
    const duration = this.countUpDuration();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out: fast at first, then settles on the final value
      const eased = 1 - Math.pow(1 - progress, 3);
      this.shown = progress < 1 ? from + (target - from) * eased : target;
      this.write(this.shown, format);
      if (progress < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Puts the formatted number into the element. */
  private write(value: number, format: Format): void {
    this.element.textContent = format(value);
  }
}
