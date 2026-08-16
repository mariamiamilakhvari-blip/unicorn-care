/**
 * The English half of the Data Processing Agreement.
 *
 * Split per locale only because the two together run past the file-length limit — they are one
 * document, composed in `legal-dpa.const.ts`. Nothing else imports these directly.
 *
 * It replaced a HIPAA Business Associate Agreement, which was the wrong instrument twice over:
 * HIPAA does not reach a clinic operating in Georgia, and the Law of Georgia on Personal Data
 * Protection requires its own written processor agreement from every controller that engages one.
 * The obligations below are that agreement, drafted from what the system actually does — the
 * sub-processors it really uses, the safeguards it really applies, the deletion path that really
 * exists. It is not legal advice and must be reviewed by counsel before a clinic relies on it.
 */
import { DPA_VERSION } from '@/shared/const/consent.const';
import { DPA_EN_PROCESSING_SECTIONS } from '@/shared/const/legal-dpa-processing-en.const';
import { DPA_EN_RIGHTS_SECTIONS } from '@/shared/const/legal-dpa-rights-en.const';
import { LegalDocument } from '@/shared/const/legal.types';

export const LEGAL_DPA_EN: LegalDocument = {
  title: 'Data Processing Agreement',
  lastUpdated: DPA_VERSION,
  intro:
    'This Data Processing Agreement supplements the Terms of Service and governs the processing ' +
    'of personal data under the Law of Georgia on Personal Data Protection. The clinic is the ' +
    'data controller: it decides why and how its patients’ data is processed. Unicorn Care is ' +
    'the processor, acting only on the clinic’s documented instructions. Accepting it at ' +
    'registration binds both parties to the terms below.',
  sections: [
    ...DPA_EN_PROCESSING_SECTIONS,
    ...DPA_EN_RIGHTS_SECTIONS,
  ],
};
