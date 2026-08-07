import { describe, expect, it } from 'vitest';

import { clientIp, UNKNOWN_IP } from '@/shared/utils/client-ip';

const headers = (entries: Record<string, string>) => new Headers(entries);

describe('clientIp', () => {
  it('takes the first entry of the forwarded chain, which is the original client', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.9, 70.41.3.18, 150.172.238.178' }))).toBe(
      '203.0.113.9'
    );
  });

  it('trims the padding proxies leave around the entries', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '  203.0.113.9 , 70.41.3.18' }))).toBe('203.0.113.9');
  });

  it('handles a single address with no chain', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip for proxies that only set that', () => {
    expect(clientIp(headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('prefers the forwarded chain when both are present', () => {
    const both = headers({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '198.51.100.7' });
    expect(clientIp(both)).toBe('203.0.113.9');
  });

  it.each([
    ['no headers at all', {}],
    ['an empty forwarded header', { 'x-forwarded-for': '' }],
    ['a forwarded header that is only whitespace', { 'x-forwarded-for': '   ' }],
  ])('records the address as unknown given %s', (_label, entries) => {
    // Never an empty string: stored beside a consent, '' reads as "not recorded yet" rather than
    // "we looked and could not tell".
    expect(clientIp(headers(entries))).toBe(UNKNOWN_IP);
  });
});
