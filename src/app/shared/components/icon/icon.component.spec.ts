import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  it('masks the named SVG from public/icons and is decorative by default', async () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'eye');
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.style.getPropertyValue('--icon-url')).toBe('url("icons/eye.svg")');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBeNull();
  });

  it('becomes a labelled image when given a label', async () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'warning');
    fixture.componentRef.setInput('label', 'Error');
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Error');
    expect(host.getAttribute('aria-hidden')).toBeNull();
  });
});

describe('IconComponent with a Bootstrap name', () => {
  it('falls back to the Bootstrap icon font for "bi-…" names', async () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'bi-truck');
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('i.bi.bi-truck')).not.toBeNull();
    expect(host.classList).not.toContain('svg-icon');
    expect(host.style.getPropertyValue('--icon-url')).toBe('');
  });
});
