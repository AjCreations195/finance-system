/**
 * Global test setup (runs before every spec file, see angular.json → test.setupFiles).
 *
 * jsdom doesn't implement window.matchMedia, which ThemeService and the
 * login page use. This stub reports "no match"; a spec can override it
 * with vi.spyOn(window, 'matchMedia') to simulate a dark OS or a wide screen.
 */
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList,
});
