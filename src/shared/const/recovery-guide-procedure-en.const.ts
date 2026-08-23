import { SeedGuideBody, SeedProcedureFamily } from '@/shared/const/recovery-guide-seed.const';

/**
 * The three drafts below are procedure-specific and clinician-supplied. Unlike the baselines they
 * name findings that belong to one operation, which is only defensible because somebody qualified
 * wrote them down for that operation.
 *
 * Severities are set one rung cautious where the sign is ambiguous: a patient sent in for something
 * that turns out to be nothing has lost an afternoon, and the reverse case is a haematoma or a
 * pulmonary embolism read as ordinary swelling. Day windows are wide for the reason the baselines
 * give — a patient still bruised on day 25 should not read that bruising ends on day 21.
 */
const RHINOPLASTY: SeedGuideBody = {
  expected: [
    {
      title: 'Mild nasal congestion',
      description:
        'Your nose will feel blocked while the lining is swollen, and breathing through it may take weeks to feel normal. Do not blow your nose unless your ' +
        'surgeon has said you can.',
      fromDay: 0,
      toDay: 21,
    },
    {
      title: 'Minor swelling and bruising around the eyes',
      description:
        'Usually most noticeable in the first few days, often worse on one side, and settling gradually after that.',
      fromDay: 0,
      toDay: 21,
    },
    {
      title: 'Slight blood-tinged discharge from the nose',
      description:
        'A small amount of pink or lightly blood-stained fluid in the first 48 hours is expected. It should lessen, not increase.',
      fromDay: 0,
      toDay: 2,
    },
  ],
  warning: [
    {
      title: 'A nosebleed you cannot stop',
      description:
        'Bleeding that continues despite sitting upright and pinching the soft part of the nose for ten minutes. Call emergency services.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'Difficulty breathing',
      description:
        'Not the blocked-nose feeling above, but struggling to get air. Call emergency services immediately.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'Severe facial pain that your pain relief does not touch',
      description:
        'Pain should ease a little each day. Pain that builds, or that the medication in your plan no longer controls, should be assessed the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
    {
      title: 'A temperature of 38°C or above',
      description: 'Contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
  ],
};

const BODY_CONTOURING: SeedGuideBody = {
  expected: [
    {
      title: 'Moderate bruising across the treated area',
      description:
        'Bruising can spread downwards with gravity and look worse before it fades. Uneven colouring between sides is common.',
      fromDay: 0,
      toDay: 28,
    },
    {
      title: 'Numbness in patches of skin over the treated area',
      description:
        'Nerves in the skin take a long time to recover. Numb, tingling or oddly sensitive patches can last months and usually improve slowly.',
      fromDay: 0,
      toDay: 180,
    },
    {
      title: 'Fluid draining from the incision sites',
      description:
        'Thin, straw-coloured or lightly blood-stained fluid from the incisions or drain sites is expected early on and should reduce day by day.',
      fromDay: 0,
      toDay: 21,
    },
  ],
  warning: [
    {
      title: 'Sudden shortness of breath or chest pain',
      description:
        'Possible blood clot on the lung. Call emergency services immediately — do not wait to contact the clinic and do not drive yourself.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'Rapid swelling or new asymmetry with severe pain',
      description:
        'One area becoming tight, swollen and painful over hours rather than days may be bleeding under the skin. Contact the clinic immediately.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Drainage that smells, or turns thick and cloudy',
      description:
        'A change in what is draining — smell, colour or thickness — suggests infection. Cover it with a clean dressing and contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
    {
      title: 'A temperature of 38°C or above, or shaking chills',
      description: 'Contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
  ],
};

const BREAST_AUGMENTATION: SeedGuideBody = {
  expected: [
    {
      title: 'Tightness across the chest',
      description:
        'A tight, heavy or restricted feeling is expected while the tissue accommodates the implants, and eases over the first weeks.',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Moderate swelling',
      description:
        'Most noticeable in the first days and settling gradually. Swelling can mask the final shape for some time.',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Mild asymmetry during the early healing weeks',
      description:
        'The two sides commonly swell, settle and drop at different rates. Judging the result while this is happening is the commonest reason for worry.',
      fromDay: 0,
      toDay: 42,
    },
  ],
  warning: [
    {
      title: 'One side suddenly enlarging or swelling, with severe pain',
      description:
        'A single side becoming markedly bigger, firm and painful over hours may be bleeding around the implant. Contact the clinic immediately, and ' +
        'emergency services if you cannot reach them.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Redness spreading from the wound, or red streaks in the skin',
      description:
        'Redness that grows day to day, or streaking away from the incision, may be a spreading skin infection. Contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
    {
      title: 'A wound edge opening or separating',
      description:
        'Cover it with a clean dressing, do not apply pressure to close it, and contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
  ],
};

export const RECOVERY_GUIDE_PROCEDURE_EN: Record<SeedProcedureFamily, SeedGuideBody> = {
  rhinoplasty: RHINOPLASTY,
  bodyContouring: BODY_CONTOURING,
  breastAugmentation: BREAST_AUGMENTATION,
};
