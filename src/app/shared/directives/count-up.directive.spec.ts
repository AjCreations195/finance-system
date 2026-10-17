import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CountUpDirective } from './count-up.directive';

@Component({
  imports: [CountUpDirective],
  template: `<p class="value" [appCountUp]="value()" [countUpFormat]="format"></p>`,
})
class HostComponent {
  readonly value = signal(0);
  readonly format = (v: number) => `${Math.round(v)} SAR`;
}

/** Pretends the user prefers reduced motion, so the count jumps straight to the value. */
function preferReducedMotion(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList);
}

describe('CountUpDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let text: () => string;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(HostComponent);
    const el: HTMLElement = fixture.nativeElement.querySelector('.value');
    text = () => el.textContent ?? '';
    await fixture.whenStable();
  }

  it('shows the final value straight away with reduced motion', async () => {
    preferReducedMotion();
    await create();
    fixture.componentInstance.value.set(1200);
    await fixture.whenStable();
    expect(text()).toBe('1200 SAR');
  });

  it('updates the text when the number changes (reduced motion)', async () => {
    preferReducedMotion();
    await create();
    fixture.componentInstance.value.set(350);
    await fixture.whenStable();
    expect(text()).toBe('350 SAR');
  });

  it('holds zero off screen and counts to the value once it scrolls into view', async () => {
    preferReducedMotion();
    let onIntersect: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersect = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );

    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.value.set(1200);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement.querySelector('.value');
    expect(el.textContent).toBe('0 SAR');

    onIntersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await fixture.whenStable();
    expect(el.textContent).toBe('1200 SAR');
  });
});
