import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTACT_METHODS,
  CONTACT_METHOD_LABELS,
  WARNING_SEVERITIES,
  WARNING_SEVERITY_LABELS,
  contactMethodLabel,
  warningSeverityLabel,
} from '@/shared/const/recovery.const';
import { AppLocale } from '@/shared/types/roles';

type MessageTree = { [key: string]: string | MessageTree };

const LOCALES: AppLocale[] = ['ka', 'en'];

const guideMessages = (locale: AppLocale): MessageTree => {
  const tree = JSON.parse(
    readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')
  ) as MessageTree;
  return tree.recoveryGuide as MessageTree;
};

const severityMessages = (locale: AppLocale): Record<string, string> => {
  const tree = JSON.parse(
    readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')
  ) as MessageTree;
  const recoveryGuide = tree.recoveryGuide as MessageTree;
  return recoveryGuide.severity as Record<string, string>;
};

describe('warning severity labels', () => {
  it.each(LOCALES)('covers every severity in %s', locale => {
    expect(Object.keys(WARNING_SEVERITY_LABELS[locale]).sort()).toEqual(
      [...WARNING_SEVERITIES].sort()
    );
  });

  /**
   * The guide editor reads these labels from the constant (it needs the guide's language, not the
   * screen's) while the patient panel reads them from the UI messages. Two readers, so the wording
   * is pinned here — a translator editing only the JSON would otherwise leave the editor stale.
   */
  it.each(LOCALES)('matches the %s UI messages word for word', locale => {
    const messages = severityMessages(locale);
    for (const severity of WARNING_SEVERITIES) {
      expect(warningSeverityLabel(locale, severity)).toBe(messages[severity]);
    }
  });
});

/**
 * The alert email composes on a background request, so it has no UI locale to render and reads
 * these from the constant. The portal and the dashboard read the same words out of the messages
 * file. Two readers again, so the wording is pinned — a translator editing only the JSON would
 * otherwise leave a clinic's email saying one thing and its queue another.
 */
describe('contact method labels', () => {
  it.each(LOCALES)('covers every method in %s', locale => {
    expect(Object.keys(CONTACT_METHOD_LABELS[locale]).sort()).toEqual([...CONTACT_METHODS].sort());
  });

  it.each(LOCALES)('matches the %s UI messages word for word', locale => {
    const messages = guideMessages(locale).contactMethod as Record<string, string>;
    for (const method of CONTACT_METHODS) {
      expect(contactMethodLabel(locale, method)).toBe(messages[method]);
    }
  });
});
