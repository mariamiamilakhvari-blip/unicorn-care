/**
 * The Georgian half of the Data Processing Agreement.
 *
 * Split per locale only because the two together run past the file-length limit — they are one
 * document, composed in `legal-dpa.const.ts`. Nothing else imports these directly.
 *
 * This is the authoritative language for the clinics the product is built for: the agreement is
 * made under Georgian law, between a Georgian clinic and its processor, and a clinic reading it
 * in Georgian is reading it in the language it will be enforced in. The English half is the
 * translation, not the other way round.
 */
import { DPA_VERSION } from '@/shared/const/consent.const';
import { DPA_KA_PROCESSING_SECTIONS } from '@/shared/const/legal-dpa-processing-ka.const';
import { DPA_KA_RIGHTS_SECTIONS } from '@/shared/const/legal-dpa-rights-ka.const';
import { LegalDocument } from '@/shared/const/legal.types';

export const LEGAL_DPA_KA: LegalDocument = {
  title: 'მონაცემთა დამუშავების ხელშეკრულება',
  lastUpdated: DPA_VERSION,
  intro:
    'ეს ხელშეკრულება ავსებს მომსახურების პირობებს და არეგულირებს პერსონალურ მონაცემთა დამუშავებას ' +
    '„პერსონალურ მონაცემთა დაცვის შესახებ“ საქართველოს კანონის შესაბამისად. კლინიკა არის ' +
    'მონაცემთა დამმუშავებელი: სწორედ ის განსაზღვრავს, რა მიზნით და როგორ მუშავდება მისი ' +
    'პაციენტების მონაცემები. Unicorn Care არის უფლებამოსილი პირი და მოქმედებს მხოლოდ კლინიკის ' +
    'დოკუმენტირებული მითითებით. რეგისტრაციისას მისი მიღება ორივე მხარეს ავალდებულებს ქვემოთ ' +
    'მოცემულ პირობებს.',
  sections: [
    ...DPA_KA_PROCESSING_SECTIONS,
    ...DPA_KA_RIGHTS_SECTIONS,
  ],
};
