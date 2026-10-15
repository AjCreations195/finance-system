import { AR } from './ar';
import { EN } from './en';

/** Flatten a nested dictionary into dot-path keys ('login.title'). */
function keys(source: object, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

/** Placeholder names in a string ('Page {{page}} of {{total}}' → ['page', 'total']). */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

function lookup(source: object, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);
}

describe('Translation dictionaries', () => {
  const enKeys = keys(EN);
  const arKeys = keys(AR);

  it('Arabic has every English key', () => {
    expect(enKeys.filter((k) => !arKeys.includes(k))).toEqual([]);
  });

  it('Arabic has no keys that English lacks', () => {
    expect(arKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('every translation is a non-empty string', () => {
    for (const [name, dict] of [['en', EN], ['ar', AR]] as const) {
      const empty = keys(dict).filter((k) => {
        const value = lookup(dict, k);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty, `empty values in ${name}`).toEqual([]);
    }
  });

  it('uses the same {{placeholders}} in both languages', () => {
    const mismatched = enKeys.filter(
      (k) => JSON.stringify(placeholders(String(lookup(EN, k)))) !== JSON.stringify(placeholders(String(lookup(AR, k) ?? ''))),
    );
    expect(mismatched).toEqual([]);
  });
});
