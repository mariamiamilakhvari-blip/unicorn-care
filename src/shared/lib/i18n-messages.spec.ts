import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

type MessageTree = { [key: string]: string | MessageTree };

const MESSAGES_DIR = join(process.cwd(), 'messages');
const LOCALES = ['ka', 'en'] as const;

const readMessages = (locale: string): MessageTree =>
  JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as MessageTree;

const flattenKeys = (tree: MessageTree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flattenKeys(value, path);
  });

const ka = readMessages('ka');
const en = readMessages('en');

const kaKeys = flattenKeys(ka).sort();
const enKeys = flattenKeys(en).sort();

const missing = (from: string[], against: string[]): string[] =>
  against.filter((key) => !from.includes(key));

describe('i18n message files', () => {
  it('exposes both locales', () => {
    expect(LOCALES).toEqual(['ka', 'en']);
    expect(kaKeys.length).toBeGreaterThan(0);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('has no keys present in en.json but missing from ka.json', () => {
    const missingInKa = missing(kaKeys, enKeys);
    expect(missingInKa, `Missing in messages/ka.json: ${missingInKa.join(', ')}`).toEqual([]);
  });

  it('has no keys present in ka.json but missing from en.json', () => {
    const missingInEn = missing(enKeys, kaKeys);
    expect(missingInEn, `Missing in messages/en.json: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('has identical deep key sets', () => {
    expect(kaKeys).toEqual(enKeys);
  });

  it('has no empty message values', () => {
    const emptyKa = kaKeys.filter((key) => resolve(ka, key).trim() === '');
    const emptyEn = enKeys.filter((key) => resolve(en, key).trim() === '');
    expect(emptyKa, `Empty values in messages/ka.json: ${emptyKa.join(', ')}`).toEqual([]);
    expect(emptyEn, `Empty values in messages/en.json: ${emptyEn.join(', ')}`).toEqual([]);
  });
});

function resolve(tree: MessageTree, path: string): string {
  const value = path.split('.').reduce<string | MessageTree>((acc, part) => {
    if (typeof acc === 'string') return acc;
    return acc[part];
  }, tree);

  return typeof value === 'string' ? value : '';
}
