import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifySvixSignature } from '@/shared/lib/svix-signature';

const SECRET = 'whsec_' + Buffer.from('a-signing-key').toString('base64');
const BODY = '{"type":"email.bounced"}';
const ID = 'msg_123';
const NOW = new Date('2026-08-08T12:00:00.000Z');

const sign = (id: string, timestamp: string, body: string) => {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  return 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
};

const stamp = () => String(Math.floor(NOW.getTime() / 1000));

describe('verifySvixSignature', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('accepts a correctly signed body', () => {
    const t = stamp();
    expect(verifySvixSignature(BODY, { id: ID, timestamp: t, signature: sign(ID, t, BODY) }, SECRET))
      .toBe(true);
  });

  it('accepts when several signatures are offered and one matches', () => {
    // Providers send more than one during a secret rotation.
    const t = stamp();
    const header = `v1,wrongsignature ${sign(ID, t, BODY)}`;
    expect(verifySvixSignature(BODY, { id: ID, timestamp: t, signature: header }, SECRET)).toBe(true);
  });

  it('rejects a body altered after signing', () => {
    const t = stamp();
    const signature = sign(ID, t, BODY);
    expect(
      verifySvixSignature('{"type":"email.delivered"}', { id: ID, timestamp: t, signature }, SECRET)
    ).toBe(false);
  });

  it('rejects a replay of an old but validly signed request', () => {
    // A captured request stays validly signed forever; age is the only thing that makes it stale.
    const old = String(Math.floor(NOW.getTime() / 1000) - 10 * 60);
    expect(
      verifySvixSignature(BODY, { id: ID, timestamp: old, signature: sign(ID, old, BODY) }, SECRET)
    ).toBe(false);
  });

  it('rejects a request timestamped in the future beyond tolerance', () => {
    const ahead = String(Math.floor(NOW.getTime() / 1000) + 10 * 60);
    expect(
      verifySvixSignature(BODY, { id: ID, timestamp: ahead, signature: sign(ID, ahead, BODY) }, SECRET)
    ).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    // A deployment without the secret must refuse callbacks, never accept them unverified.
    const t = stamp();
    expect(verifySvixSignature(BODY, { id: ID, timestamp: t, signature: sign(ID, t, BODY) }, undefined))
      .toBe(false);
  });

  it.each([
    ['no id', { id: null, timestamp: '1', signature: 'v1,x' }],
    ['no timestamp', { id: ID, timestamp: null, signature: 'v1,x' }],
    ['no signature', { id: ID, timestamp: '1', signature: null }],
    ['a non-numeric timestamp', { id: ID, timestamp: 'yesterday', signature: 'v1,x' }],
  ])('rejects a request with %s', (_label, headers) => {
    expect(verifySvixSignature(BODY, headers, SECRET)).toBe(false);
  });
});
