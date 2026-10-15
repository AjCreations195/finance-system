import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../core/services/language.service';
import { LocalDatePipe, MoneyPipe, formatMoney } from './format.pipes';
import { LocalizePipe } from './localize.pipe';
import { TranslatePipe } from './translate.pipe';

describe('Pipes', () => {
  let language: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [TranslatePipe, LocalizePipe, LocalDatePipe, MoneyPipe] });
    language = TestBed.inject(LanguageService);
  });

  describe('TranslatePipe', () => {
    it('translates a key with parameters', () => {
      const pipe = TestBed.inject(TranslatePipe);
      expect(pipe.transform('common.pageOf', { page: 1, total: 3 })).toBe('Page 1 of 3');
    });

    it('follows the active language', () => {
      const pipe = TestBed.inject(TranslatePipe);
      const english = pipe.transform('common.filter');
      language.setLanguage('ar');
      expect(pipe.transform('common.filter')).not.toBe(english);
    });
  });

  describe('LocalizePipe', () => {
    const text = { en: 'Sugar', ar: 'سكر' };

    it('picks the value for the active language', () => {
      const pipe = TestBed.inject(LocalizePipe);
      expect(pipe.transform(text)).toBe('Sugar');
      language.setLanguage('ar');
      expect(pipe.transform(text)).toBe('سكر');
    });

    it('returns an empty string for null or undefined', () => {
      const pipe = TestBed.inject(LocalizePipe);
      expect(pipe.transform(null)).toBe('');
      expect(pipe.transform(undefined)).toBe('');
    });
  });

  describe('LocalDatePipe', () => {
    it('formats a date-only string without shifting the day', () => {
      const pipe = TestBed.inject(LocalDatePipe);
      expect(pipe.transform('2026-01-05')).toBe('Jan 5, 2026');
    });

    it('supports the long style', () => {
      const pipe = TestBed.inject(LocalDatePipe);
      expect(pipe.transform('2026-01-05', 'long')).toBe('January 5, 2026');
    });

    it('uses Arabic month names with Western digits in Arabic', () => {
      const pipe = TestBed.inject(LocalDatePipe);
      language.setLanguage('ar');
      const result = pipe.transform('2026-01-05');
      expect(result).toContain('2026');
      expect(result).toMatch(/[؀-ۿ]/);
    });

    it('returns an empty string for empty values', () => {
      const pipe = TestBed.inject(LocalDatePipe);
      expect(pipe.transform(null)).toBe('');
      expect(pipe.transform('')).toBe('');
    });
  });

  describe('MoneyPipe / formatMoney', () => {
    it('formats a full amount with two decimals in QAR', () => {
      const pipe = TestBed.inject(MoneyPipe);
      expect(pipe.transform(12500)).toMatch(/QAR\s?12,500\.00/);
    });

    it('formats a compact amount', () => {
      expect(formatMoney(12_500, 'en-US', 'compact')).toMatch(/QAR\s?12\.5K/);
    });

    it('formats zero but not null', () => {
      const pipe = TestBed.inject(MoneyPipe);
      expect(pipe.transform(0)).toMatch(/0\.00/);
      expect(pipe.transform(null)).toBe('');
    });
  });
});
