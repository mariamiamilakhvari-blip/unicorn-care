/**
 * The Data Processing Agreement, English — what the processor undertakes about the data itself.
 *
 * Split from the rest of the document only because the two together run past the file-length
 * limit. The seam is placed where a reader would put it: everything up to and including the
 * sub-processors is about how data is handled, and everything after it is about what happens when
 * something goes wrong or someone exercises a right. Composed in `legal-dpa-en.const.ts`.
 */
import { LEGAL_CONTACT_EMAIL } from '@/shared/const/legal-contact.const';
import { LegalSection } from '@/shared/const/legal.types';

export const DPA_EN_PROCESSING_SECTIONS: LegalSection[] = [
  {
    heading: 'Not a medical device, and never an emergency service',
    paragraphs: [
      'Unicorn Care is a post-operative assistance tool. It does not diagnose, does not treat, ' +
          'does not triage and does not monitor anyone. It is not a diagnostic device, not a ' +
          'clinical decision support system, and not a medical device of any class.',
      'Nothing the platform sends — a reminder, an adherence figure — is medical advice or a ' +
          'substitute for consultation with a clinician. Under the Law of Georgia on Health Care ' +
          'every clinical judgement remains the clinic’s.',
      'The platform is not monitored in real time and must never be relied on in an emergency. ' +
          'A patient experiencing a medical emergency must call 112, or the local emergency ' +
          'number where they are, or go to the nearest emergency department. Messages sent ' +
          'through this platform are not seen by a clinician on receipt and may not be read at ' +
          'all.',
    ],
  },
  {
    heading: 'Roles and definitions',
    paragraphs: [
      'Terms used but not defined here have the meaning given to them in the Law of Georgia on ' +
          'Personal Data Protection.',
      '“Personal data” means any information relating to an identified or identifiable natural ' +
          'person. “Data of special category” includes data concerning health, which is what ' +
          'this platform exists to carry and which the Law subjects to stricter conditions. ' +
          '“Controller” means the clinic. “Processor” means Unicorn Care. “Data subject” means ' +
          'the patient. “Personal Data Protection Service” means the supervisory authority ' +
          'established under that Law.',
      'The clinic is the controller of its patients’ data throughout. Unicorn Care never ' +
          'determines the purposes of processing, never processes patient data for its own ends, ' +
          'and never sells or discloses it for advertising.',
    ],
  },
  {
    heading: 'Scope of processing and the clinic’s instructions',
    paragraphs: [
      'Unicorn Care processes patient personal data solely to provide the service: storing the ' +
          'care plan the clinic authors, generating the reminders it prescribes, delivering ' +
          'those reminders to the patient, and showing the clinic what was completed.',
      'Processing happens only on the clinic’s documented instructions, of which this ' +
          'Agreement and the clinic’s use of the platform are the record. If Unicorn Care is ' +
          'required by law to process data otherwise, it will inform the clinic before doing so ' +
          'unless that law forbids the notice.',
      'Data concerning health is processed on the basis of the data subject’s explicit consent, ' +
          'which the clinic obtains and warrants it holds. Consents captured through the ' +
          'platform are recorded with their timestamp, the version of the wording shown, the ' +
          'source of the acceptance, and the moment of any withdrawal.',
      'Personnel authorised to access personal data are bound by confidentiality obligations ' +
          'that survive the end of their engagement.',
    ],
  },
  {
    heading: 'Security of processing',
    paragraphs: [
      'Unicorn Care applies organisational and technical measures appropriate to the risk, as ' +
          'the Law of Georgia on Personal Data Protection requires of a processor handling data ' +
          'of special category.',
      'In practice that means: personal data encrypted at rest with AES-256 at the database ' +
          'and object-storage providers; all traffic to the platform, including patient portal ' +
          'links, carried over TLS 1.3 with HTTP Strict Transport Security enforced; access ' +
          'scoped so a clinic can only ever read its own records; patient portal access by ' +
          'single-use, expiring links rather than shared credentials; and passwords stored as ' +
          'hashes, never in a recoverable form.',
      'Third-party services receive the minimum data required to perform their function. An ' +
          'email provider receives the recipient address and the message; a push service ' +
          'receives an opaque endpoint and an encrypted payload. Notification content carries no ' +
          'diagnosis, no procedure name and no free-text clinical instruction, because a ' +
          'lock-screen preview is readable by anyone holding the phone.',
      'Access to production data is limited to the personnel who need it to operate the ' +
          'service, and is subject to the confidentiality obligations above.',
    ],
  },
  {
    heading: 'Sub-processors and transfer of data abroad',
    paragraphs: [
      'Unicorn Care engages sub-processors for hosting, database storage, object storage, ' +
          'email delivery, push notification delivery and payment processing. Each is bound in ' +
          'writing to obligations no less strict than those in this Agreement, as the Law ' +
          'requires of any onward engagement.',
      'The Privacy Policy names the current sub-processors. A clinic that needs the list as of ' +
          'a given date may request it. Unicorn Care will give the clinic notice of an intended ' +
          'change of sub-processor, and the clinic may object.',
      'Some sub-processors process data outside Georgia. Under the Law of Georgia on Personal ' +
          'Data Protection such a transfer is permitted where the receiving country provides ' +
          'appropriate safeguards, or where one of the other grounds in that Law applies. ' +
          'Unicorn Care selects processing regions accordingly and contracts for appropriate ' +
          'safeguards with each recipient. A clinic that requires its data to remain within a ' +
          'particular jurisdiction should raise it at ' +
          LEGAL_CONTACT_EMAIL +
          ' before entering patient data.',
    ],
  },
];
