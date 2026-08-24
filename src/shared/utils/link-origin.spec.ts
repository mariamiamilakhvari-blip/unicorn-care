import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isLoopbackOrigin, linkOrigin } from '@/shared/utils/link-origin';

const PUBLIC_ORIGIN = 'https://www.unicorncare.space';

describe('isLoopbackOrigin', () => {
  it.each([
    'http://localhost:3001',
    'http://localhost',
    'https://localhost:3000/',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:8080',
    'http://[::1]:3001',
    'HTTP://LocalHost:3001',
    'http://localhost:3001/api/auth',
  ])('recognises %s', origin => {
    expect(isLoopbackOrigin(origin)).toBe(true);
  });

  /** A real host that merely contains the word must not be swept up with the loopbacks. */
  it.each([
    'https://www.unicorncare.space',
    'https://localhost.unicorncare.space',
    'https://mylocalhost.com',
    'https://127.0.0.1.example.com',
  ])('leaves %s alone', origin => {
    expect(isLoopbackOrigin(origin)).toBe(false);
  });
});

describe('linkOrigin', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it('uses the configured origin when it is reachable', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://unicorncare.space');

    expect(linkOrigin()).toBe('https://unicorncare.space');
  });

  /*
    The bug this helper exists for. A production `NEXTAUTH_URL` left pointing at the dev server is
    not a preference worth honouring — it mints a link that resolves nowhere except the machine
    that generated it, and the patient meets it days later as a connection error.
  */
  describe('a loopback origin outside development', () => {
    it.each(['production', 'test'])('is ignored in %s', nodeEnv => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3001');

      expect(linkOrigin()).toBe(PUBLIC_ORIGIN);
    });

    it('is honoured in development, so a local link opens the local app', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3001');

      expect(linkOrigin()).toBe('http://localhost:3001');
    });
  });

  /** Interpolating the bare variable used to produce `undefined/p/<token>`. */
  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('falls back to the public origin when it is %s', (_case, value) => {
    vi.stubEnv('NEXTAUTH_URL', value);

    expect(linkOrigin()).toBe(PUBLIC_ORIGIN);
  });

  /** Route constants all start with a slash, and `//p/login/x` is a 404 on some hosts. */
  it('strips a trailing slash so the path never doubles it', () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://unicorncare.space///');

    expect(linkOrigin()).toBe('https://unicorncare.space');
  });

  it('trims surrounding whitespace from the configured value', () => {
    vi.stubEnv('NEXTAUTH_URL', '  https://unicorncare.space  ');

    expect(linkOrigin()).toBe('https://unicorncare.space');
  });
});
