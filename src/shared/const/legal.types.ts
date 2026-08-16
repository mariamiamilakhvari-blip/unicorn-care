/** Shared shape for the legal documents, kept apart so each document file imports only this. */
export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  /**
   * When this document last changed, as `YYYY-MM-DD`.
   *
   * Per-document rather than one shared constant. The documents are revised on their own
   * schedules, and a single date meant publishing a new one re-dated the two that had not
   * changed — or, as happened with the processor agreement, showed a brand-new one as older than it was,
   * disagreeing with the version recorded against every clinic's acceptance of it.
   *
   * Required, not optional: a document that forgets its date fails the build rather than
   * inheriting a wrong one silently.
   */
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalSlug = 'terms' | 'privacy' | 'dpa';
