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

  it('exposes its name for CSS targeting', async () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'truck');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).getAttribute('data-icon')).toBe('truck');
  });
});
