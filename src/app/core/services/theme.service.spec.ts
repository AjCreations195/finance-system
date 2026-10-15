import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'fs-theme';

describe('ThemeService', () => {
  const html = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    html.removeAttribute('data-bs-theme');
  });

  afterEach(() => vi.restoreAllMocks());

  /** Create the service and let its effect write to the DOM. */
  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  function mockOsPreference(dark: boolean): void {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: dark } as MediaQueryList);
  }

  it('uses the saved theme first', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    mockOsPreference(false);
    expect(create().theme()).toBe('dark');
  });

  it('falls back to the OS preference when nothing is saved', () => {
    mockOsPreference(true);
    expect(create().theme()).toBe('dark');
  });

  it('defaults to light', () => {
    mockOsPreference(false);
    expect(create().theme()).toBe('light');
  });

  it('ignores an invalid saved value', () => {
    localStorage.setItem(STORAGE_KEY, 'purple');
    mockOsPreference(false);
    expect(create().theme()).toBe('light');
  });

  it('applies the theme to <html data-bs-theme> and saves it', () => {
    mockOsPreference(false);
    const service = create();

    service.setTheme('dark');
    TestBed.tick();

    expect(html.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('toggle switches between light and dark', () => {
    mockOsPreference(false);
    const service = create();

    service.toggle();
    expect(service.theme()).toBe('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
  });

  it('still works when localStorage throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mockOsPreference(false);

    const service = create();
    service.toggle();
    TestBed.tick();

    expect(html.getAttribute('data-bs-theme')).toBe('dark');
  });
});
