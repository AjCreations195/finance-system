import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

describe('App', () => {
  beforeEach(async () => {
    // Start every test from a clean state (no saved theme/language).
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the page outlet and the toast area', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-toast-container')).not.toBeNull();
  });

  it('should switch the page direction with the language (Arabic → RTL, English → LTR)', async () => {
    const fixture = TestBed.createComponent(App);
    const language = TestBed.inject(LanguageService);
    const html = document.documentElement;

    language.setLanguage('ar');
    await fixture.whenStable();
    expect(html.getAttribute('dir')).toBe('rtl');
    expect(html.getAttribute('lang')).toBe('ar');

    language.setLanguage('en');
    await fixture.whenStable();
    expect(html.getAttribute('dir')).toBe('ltr');
    expect(html.getAttribute('lang')).toBe('en');
  });

  it('should toggle between light and dark mode', async () => {
    const fixture = TestBed.createComponent(App);
    const theme = TestBed.inject(ThemeService);
    const html = document.documentElement;

    theme.setTheme('light');
    await fixture.whenStable();
    expect(html.getAttribute('data-bs-theme')).toBe('light');

    theme.toggle();
    await fixture.whenStable();
    expect(html.getAttribute('data-bs-theme')).toBe('dark');
  });
});
