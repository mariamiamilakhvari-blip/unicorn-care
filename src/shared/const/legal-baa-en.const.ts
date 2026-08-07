/**
 * The English half of the HIPAA Business Associate Agreement.
 *
 * Split per locale only because the two together run past the file-length limit — they are one
 * document, composed in `legal-baa.const.ts`. Nothing else imports these directly.
 */
import { BAA_VERSION } from '@/shared/const/consent.const';
import { LEGAL_CONTACT_EMAIL } from '@/shared/const/legal-contact.const';
import { LegalDocument } from '@/shared/const/legal.types';

export const LEGAL_BAA_EN: LegalDocument = {
  title: 'Business Associate Agreement (HIPAA)',
  lastUpdated: BAA_VERSION,
  intro:
    'This Business Associate Agreement supplements the Terms of Service for clinics in the ' +
    'United States that are Covered Entities under HIPAA. The clinic is the Covered Entity. ' +
    'Unicorn Care is the Business Associate, because it creates, receives, maintains and ' +
    'transmits Protected Health Information on the clinic’s behalf. Accepting it at ' +
    'registration binds both parties to the terms below.',
  sections: [
    {
      heading: 'Not a medical device, and never an emergency service',
      paragraphs: [
        'Unicorn Care is a post-operative assistance tool. It does not diagnose, does not treat, ' +
          'does not triage and does not monitor anyone. It is not a diagnostic device, not a ' +
          'clinical decision support system, and not a medical device of any class.',
        'Nothing the platform sends — a reminder, an adherence figure, an assistant reply — is ' +
          'medical advice or a substitute for consultation with a clinician. Every clinical ' +
          'judgement remains the clinic’s.',
        'The platform is not monitored in real time and must never be relied on in an emergency. ' +
          'A patient experiencing a medical emergency must call 911 (or the local emergency ' +
          'number) or go to the nearest emergency department. Messages sent through this ' +
          'platform are not seen by a clinician on receipt and may not be read at all.',
      ],
    },
    {
      heading: 'Definitions',
      paragraphs: [
        'Terms used but not defined here have the meaning given to them in the HIPAA Rules: the ' +
          'Privacy, Security, Breach Notification and Enforcement Rules at 45 CFR Parts 160 and ' +
          '164, as amended by the HITECH Act.',
        '“Protected Health Information” (PHI) means individually identifiable health information ' +
          'the Business Associate creates, receives, maintains or transmits for the Covered ' +
          'Entity. “ePHI” means PHI held or transmitted in electronic form, which is all PHI in ' +
          'this platform. “Covered Entity” means the clinic. “Business Associate” means ' +
          'Unicorn Care.',
      ],
    },
    {
      heading: 'Permitted uses and disclosures',
      paragraphs: [
        'The Business Associate may use and disclose PHI only to perform the services the ' +
          'clinic engaged it for — storing patients, procedures and recovery plans, generating ' +
          'and sending the reminders the clinic schedules, and reporting adherence back to the ' +
          'clinic — and only as this Agreement or the law permits.',
        'The Business Associate may use PHI for its own proper management and administration, ' +
          'and to carry out its legal responsibilities. Where it discloses PHI for those ' +
          'purposes, it will obtain reasonable assurances that the recipient will hold it in ' +
          'confidence and report any breach of confidentiality back.',
        'The Business Associate will not use or disclose PHI in any way that would violate the ' +
          'Privacy Rule if the Covered Entity did it, will not sell PHI, and will not use or ' +
          'disclose PHI for marketing, advertising, model training or any purpose unrelated to ' +
          'the service.',
        'The Business Associate applies the minimum necessary standard: it requests, uses and ' +
          'discloses only the PHI needed for the task at hand.',
      ],
    },
    {
      heading: 'Safeguards',
      paragraphs: [
        'The Business Associate will use appropriate administrative, physical and technical ' +
          'safeguards, and comply with the Security Rule with respect to ePHI, to prevent any ' +
          'use or disclosure of PHI other than as this Agreement provides.',
        'In practice that means: PHI encrypted in transit over TLS and at rest at the database ' +
          'provider; access scoped so a clinic can only ever read its own records; patient ' +
          'portal access by single-use, expiring links rather than shared credentials; and ' +
          'passwords stored as hashes, never in a recoverable form.',
        'Access to production data is limited to the personnel who need it to operate the ' +
          'service, and is subject to the same confidentiality obligations as this Agreement.',
      ],
    },
    {
      heading: 'Subcontractors',
      paragraphs: [
        'The Business Associate will ensure that any subcontractor that creates, receives, ' +
          'maintains or transmits PHI on its behalf agrees in writing to restrictions and ' +
          'conditions at least as strict as those that apply here, as 45 CFR §164.502(e)(1)(ii) ' +
          'requires.',
        'The service is operated on infrastructure and third-party processors named in the ' +
          'Privacy Policy — hosting, the database provider, the email sender, the push ' +
          'notification service and the payment provider. The Privacy Policy is the current ' +
          'list; a clinic that needs the list as of a given date may request it.',
      ],
    },
    {
      heading: 'Reporting incidents and breaches',
      paragraphs: [
        'The Business Associate will report to the Covered Entity any use or disclosure of PHI ' +
          'not permitted by this Agreement of which it becomes aware, including any Breach of ' +
          'Unsecured PHI as defined at 45 CFR §164.402, and any Security Incident affecting ' +
          'ePHI.',
        'Notification will be made without unreasonable delay and in no case later than thirty ' +
          'calendar days after discovery, to the contact address the clinic holds on its ' +
          'account. It will include, to the extent known, what happened, which individuals and ' +
          'which categories of PHI were involved, what has been done, and what the Business ' +
          'Associate recommends the clinic do next.',
        'Unsuccessful Security Incidents that result in no unauthorised access — blocked scans, ' +
          'failed logins, rejected connection attempts — are reported on request rather than ' +
          'individually, which this paragraph serves as notice of.',
        'Breach notification to affected individuals, to the HHS Secretary and, where required, ' +
          'to the media is the Covered Entity’s obligation. The Business Associate will provide ' +
          'the information the clinic needs to make it.',
      ],
    },
    {
      heading: 'Individual rights',
      paragraphs: [
        'Access (45 CFR §164.524): the platform shows the clinic the whole record it holds for ' +
          'each of its patients, so the clinic can respond to an access request directly. Where ' +
          'a request cannot be satisfied from the dashboard, the Business Associate will supply ' +
          'the PHI in a designated record set within a time that lets the clinic meet its own ' +
          'deadline.',
        'Amendment (45 CFR §164.526): patient records are editable by the clinic in the ' +
          'dashboard, and the Business Associate will make any amendment the clinic directs.',
        'Accounting of disclosures (45 CFR §164.528): the Business Associate will document ' +
          'disclosures of PHI that would be subject to an accounting and provide that ' +
          'information to the clinic on request.',
        'Requests are answered to the clinic, not to the individual. The Business Associate has ' +
          'no relationship with the patient and will not act on an instruction that reaches it ' +
          'directly from one; it will refer the patient to the clinic.',
      ],
    },
    {
      heading: 'Access by the Secretary',
      paragraphs: [
        'The Business Associate will make its internal practices, books and records relating to ' +
          'the use and disclosure of PHI available to the Secretary of Health and Human ' +
          'Services for the purpose of determining the Covered Entity’s compliance with the ' +
          'Privacy Rule.',
      ],
    },
    {
      heading: 'The clinic’s obligations',
      paragraphs: [
        'The Covered Entity will obtain any consent, authorisation or permission the law ' +
          'requires before entering a patient’s information, and will notify the Business ' +
          'Associate of any change to, or revocation of, a permission that affects how PHI may ' +
          'be used.',
        'The Covered Entity will not request the Business Associate to use or disclose PHI in ' +
          'any way that would not be permitted under the Privacy Rule if the Covered Entity did ' +
          'it itself.',
        'Reminders and portal messages travel over email, push notification and the web to a ' +
          'device the clinic does not control. The Covered Entity is responsible for deciding ' +
          'what detail is appropriate to send and for the accuracy of the addresses it enters.',
      ],
    },
    {
      heading: 'Term, termination and what happens to PHI',
      paragraphs: [
        'This Agreement takes effect when the clinic accepts it at registration and continues ' +
          'until all PHI held for the clinic has been returned or destroyed, or protections ' +
          'extended to it under the paragraph below.',
        'The Covered Entity may terminate this Agreement, and the underlying account, if the ' +
          'Business Associate materially breaches it and does not cure the breach within thirty ' +
          'days of written notice.',
        'On termination the Business Associate will return or destroy all PHI it holds for the ' +
          'clinic. Deleting the clinic account from the dashboard erases its patients, plans and ' +
          'reminders and cannot be undone. Where destruction is not feasible for a copy — a ' +
          'backup not yet rotated out, for example — the Business Associate will extend the ' +
          'protections of this Agreement to it and limit further use to the purposes that make ' +
          'destruction infeasible, until destruction is possible.',
      ],
    },
    {
      heading: 'Interpretation and how to execute a signed copy',
      paragraphs: [
        'This Agreement supplements the Terms of Service. Where the two conflict on the ' +
          'handling of PHI, this Agreement governs. Any ambiguity is resolved in favour of a ' +
          'meaning that complies with the HIPAA Rules, and a reference to a section of the ' +
          'HIPAA Rules means that section as amended from time to time.',
        'This is a baseline drafted from how the platform behaves. It is not legal advice, and ' +
          'a clinic should have its own counsel review it before relying on it.',
        'A clinic that needs a countersigned copy, its own paper, or the sub-processor list as ' +
          `of a given date should write to ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
  ],
};
