import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

const STORAGE_KEY = 'fs-lang';

describe('LanguageService', () => {
  const html = document.documentElement;
  let link: HTMLLinkElement;

  beforeEach(() => {
    localStorage.clear();
    link = document.createElement('link');
    link.id = 'bootstrap-css';
    link.href = 'assets/bootstrap/bootstrap.min.css';
    document.head.appendChild(link);
  });

  afterEach(() => {
    link.remove();
    vi.restoreAllMocks();
  });

  function create(): LanguageService {
    const service = TestBed.inject(LanguageService);
    TestBed.tick();
    return service;
  }

  describe('initial language', () => {
    it('defaults to English', () => {
      expect(create().lang()).toBe('en');
    });

    it('restores a saved language', () => {
      localStorage.setItem(STORAGE_KEY, 'ar');
      expect(create().lang()).toBe('ar');
    });

    it('ignores an unsupported saved value', () => {
      localStorage.setItem(STORAGE_KEY, 'fr');
      expect(create().lang()).toBe('en');
    });

    it('falls back to English when storage is blocked', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(create().lang()).toBe('en');
    });
  });

  describe('switching language', () => {
    it('Arabic sets RTL, the Arabic locale and the RTL Bootstrap build', () => {
      const service = create();
      service.setLanguage('ar');
      TestBed.tick();

      expect(service.dir()).toBe('rtl');
      expect(service.isRtl()).toBe(true);
      expect(service.locale()).toBe('ar-u-nu-latn');
      expect(html.getAttribute('lang')).toBe('ar');
      expect(html.getAttribute('dir')).toBe('rtl');
      expect(link.href).toContain('bootstrap.rtl.min.css');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('ar');
    });

    it('English sets LTR and the normal Bootstrap build', () => {
      localStorage.setItem(STORAGE_KEY, 'ar');
      const service = create();
      service.setLanguage('en');
      TestBed.tick();

      expect(html.getAttribute('dir')).toBe('ltr');
      expect(link.href).toMatch(/bootstrap\.min\.css$/);
    });

    it('toggle flips between the two languages', () => {
      const service = create();
      service.toggle();
      expect(service.lang()).toBe('ar');
      service.toggle();
      expect(service.lang()).toBe('en');
    });

    it('works when the Bootstrap <link> is missing', () => {
      link.remove();
      const service = create();
      service.setLanguage('ar');
      expect(() => TestBed.tick()).not.toThrow();
    });
  });

  describe('translate', () => {
    it('returns the text for the active language', () => {
      const service = create();
      expect(service.translate('common.filter')).toBe('Filter');

      service.setLanguage('ar');
      expect(service.translate('common.filter')).not.toBe('Filter');
    });

    it('fills {{placeholders}} and leaves unknown ones untouched', () => {
      const service = create();
      expect(service.translate('common.pageOf', { page: 2, total: 9 })).toBe('Page 2 of 9');
      expect(service.translate('common.pageOf', { page: 2 })).toBe('Page 2 of {{total}}');
    });

    it('returns the key itself when no translation exists', () => {
      expect(create().translate('does.not.exist')).toBe('does.not.exist');
    });

    it('returns the key for a path that points to a group, not a string', () => {
      expect(create().translate('common')).toBe('common');
    });
  });
});
