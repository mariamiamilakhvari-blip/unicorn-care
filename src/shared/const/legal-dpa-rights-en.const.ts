/**
 * The Data Processing Agreement, English — incidents, data subject rights, retention, and the
 * administrative terms.
 *
 * The second half of the document; see `legal-dpa-processing-en.const.ts` for why it is split and
 * where the seam falls. Composed in `legal-dpa-en.const.ts`.
 */
import { LEGAL_CONTACT_EMAIL } from '@/shared/const/legal-contact.const';
import { LegalSection } from '@/shared/const/legal.types';
import { CLINICAL_RECORD_RETENTION_YEARS } from '@/shared/const/retention.const';

export const DPA_EN_RIGHTS_SECTIONS: LegalSection[] = [
  {
    heading: 'Incidents and breach notification',
    paragraphs: [
      'Unicorn Care will report to the clinic any processing of personal data not permitted by ' +
          'this Agreement of which it becomes aware, and any breach of security leading to the ' +
          'accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or ' +
          'access to personal data.',
      'Notification will be made without undue delay after discovery, to the contact address ' +
          'the clinic holds on its account, so that the clinic can meet its own notification ' +
          'deadline to the Personal Data Protection Service. It will include, to the extent ' +
          'known, what happened, which data subjects and which categories of data were ' +
          'involved, what has been done, and what Unicorn Care recommends the clinic do next.',
      'Unsuccessful security events that result in no unauthorised access — blocked scans, ' +
          'failed logins, rejected connection attempts — are reported on request rather than ' +
          'individually, which this paragraph serves as notice of.',
      'Notification to the Personal Data Protection Service, and to affected data subjects ' +
          'where the Law requires it, is the clinic’s obligation as controller. Unicorn Care ' +
          'will provide the information the clinic needs to make it.',
    ],
  },
  {
    heading: 'Assisting with data subject rights',
    paragraphs: [
      'The Law of Georgia on Personal Data Protection and the Law of Georgia on the Rights of ' +
          'the Patient give the patient rights of access, correction, and — within the limits ' +
          'below — erasure, together with the right to withdraw consent at any time. Answering ' +
          'them is the clinic’s obligation; Unicorn Care builds the means.',
      'The patient portal lets a patient download everything held about them in a structured, ' +
          'machine-readable form, without waiting on anyone. Correction and erasure requests ' +
          'are filed through the portal and routed to the clinic, which answers them and records ' +
          'the answer.',
      'A patient may withdraw consent to automated messages, or to the portal itself, at any ' +
          'time — through the portal or by telling clinic staff, who can record it on their ' +
          'behalf. Withdrawal takes effect immediately and stops further automated dispatch. It ' +
          'does not alter the clinical record or the care the clinic provides.',
    ],
  },
  {
    heading: 'Retention, erasure and what must be kept',
    paragraphs: [
      'Personal data is retained only as long as the purpose requires, except where another ' +
          'law requires it to be kept longer — which, for a clinical record, it does.',
      'The Law of Georgia on Health Care and the record-keeping rules made under it require ' +
          'clinical records to be retained for a fixed period. The platform’s configured ' +
          'default is ' +
          CLINICAL_RECORD_RETENTION_YEARS +
          ' years, and a clinic operating under a longer sectoral rule should tell Unicorn Care ' +
          'so it can be raised. No automated routine deletes a care plan, a reminder history, a ' +
          'recovery log or a symptom report inside that period.',
      'An erasure request is therefore answered in two parts. Identifying and contact data — ' +
          'name, telephone number, email address, free-text notes — is erased. The clinical ' +
          'record is retained for the statutory period and severed from those identifiers. Data ' +
          'a clinician needs to read the record safely, including recorded allergies, is kept. ' +
          'Where a request cannot be met in full the clinic must give the patient the reason in ' +
          'writing, and the platform records it.',
      'On termination, and at the clinic’s choice, Unicorn Care will return or delete the ' +
          'personal data it holds for that clinic, except what it is required by law to retain. ' +
          'Anything retained stays subject to this Agreement for as long as it is held.',
    ],
  },
  {
    heading: 'The clinic’s obligations',
    paragraphs: [
      'The clinic warrants that it has a lawful basis for every patient record it enters, ' +
          'including the data subject’s explicit consent to the processing of data concerning ' +
          'health, and that it has informed the patient as the Law of Georgia on the Rights of ' +
          'the Patient requires.',
      'The clinic is responsible for the accuracy of what it enters, for keeping account ' +
          'credentials confidential, for removing staff access when someone leaves, and for the ' +
          'clinical content of every care plan it authors.',
      'The clinic must not enter data the platform does not ask for. It is built for ' +
          'post-operative reminders and the record around them; it is not a general medical ' +
          'record system, and data minimisation is a duty the controller owes, not one the ' +
          'processor can discharge on its behalf.',
    ],
  },
  {
    heading: 'Audit and supervision',
    paragraphs: [
      'Unicorn Care will make available to the clinic the information reasonably necessary to ' +
          'demonstrate compliance with this Agreement, and will cooperate with an inspection ' +
          'carried out by the Personal Data Protection Service or by an auditor the clinic ' +
          'mandates.',
      'Where an inspection would expose another clinic’s data, it will be arranged so that it ' +
          'does not — an audit right over a shared platform cannot become a route into a third ' +
          'party’s patient records.',
    ],
  },
  {
    heading: 'Term, interpretation and a signed copy',
    paragraphs: [
      'This Agreement takes effect when the clinic accepts it at registration and continues ' +
          'for as long as Unicorn Care processes personal data on the clinic’s behalf. The ' +
          'version accepted is recorded against the clinic’s account with the date and the ' +
          'originating address.',
      'Any ambiguity is resolved in favour of an interpretation that complies with the Law of ' +
          'Georgia on Personal Data Protection, and a reference to a provision of that Law means ' +
          'the provision as amended from time to time. Where this Agreement and the Terms of ' +
          'Service conflict on the processing of personal data, this Agreement prevails.',
      'A clinic that needs a countersigned copy on paper may request one at ' +
          LEGAL_CONTACT_EMAIL +
          '.',
    ],
  },
];
