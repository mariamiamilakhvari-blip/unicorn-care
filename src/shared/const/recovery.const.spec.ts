import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WARNING_SEVERITIES,
  WARNING_SEVERITY_LABELS,
  warningSeverityLabel,
} from '@/shared/const/recovery.const';
import { AppLocale } from '@/shared/types/roles';

type MessageTree = { [key: string]: string | MessageTree };

const LOCALES: AppLocale[] = ['ka', 'en'];

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
