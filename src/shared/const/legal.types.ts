/** Shared shape for the legal documents, kept apart so each document file imports only this. */
export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalSlug = 'terms' | 'privacy';
