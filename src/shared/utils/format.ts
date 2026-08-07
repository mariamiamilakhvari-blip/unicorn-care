export function formatDate(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const BYTES_PER_UNIT = 1024;

/**
 * A file size a person can read at a glance.
 *
 * Binary units labelled with the decimal abbreviations, which is what every operating system's
 * file browser shows — matching the number a user sees next to the same file elsewhere matters
 * more here than the strict KiB spelling nobody outside this file would recognise.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${BYTE_UNITS[0]}`;

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
    BYTE_UNITS.length - 1
  );
  const value = bytes / BYTES_PER_UNIT ** exponent;

  // Whole bytes never need a decimal; anything larger reads better with one.
  return `${exponent === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[exponent]}`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
