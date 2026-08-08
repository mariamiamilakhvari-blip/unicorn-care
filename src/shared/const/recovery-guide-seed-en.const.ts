import { SeedFamily, SeedGuideBody } from '@/shared/const/recovery-guide-seed.const';

/**
 * Platform-default drafts, English. Seeded unpublished — a clinician reviews and publishes.
 *
 * Deliberately generic. Every line here is true of any procedure in its family; nothing states a
 * timeline, a technique or a complication rate specific to one operation. That is the clinic's
 * to write, and the editor exists so they can. This is a starting point that is safe to read,
 * not a finished guide.
 *
 * Day windows are wide for the same reason. A patient whose swelling is settling on day 9 should
 * not read that it ends on day 7 and conclude something is wrong.
 */
const SURGICAL: SeedGuideBody = {
  expected: [
    {
      title: 'Swelling and bruising around the treated area',
      description:
        'Usually most noticeable in the first few days and then settling gradually. It is common for one side to look more swollen than the other.',
      fromDay: 0,
      toDay: 21,
    },
    {
      title: 'Discomfort that responds to the pain relief you were prescribed',
      description:
        'Pain should be manageable with the medication in your plan and should ease a little each day rather than build.',
      fromDay: 0,
      toDay: 14,
    },
    {
      title: 'Feeling tired and needing more rest than usual',
      description:
        'An anaesthetic and healing both take energy. Tiredness in the first couple of weeks is expected.',
      fromDay: 0,
      toDay: 21,
    },
    {
      title: 'Tightness, numbness or odd sensations near the area',
      description:
        'Nerves recovering after surgery can feel numb, tingly or unusually sensitive. This often takes months to settle fully.',
      fromDay: 0,
      toDay: 180,
    },
    {
      title: 'Scars changing colour as they mature',
      description:
        'A scar commonly looks pink or raised before it fades and flattens. This is slow and continues well past the point you feel recovered.',
      fromDay: 14,
      toDay: 365,
    },
  ],
  warning: [
    {
      title: 'Difficulty breathing, chest pain, or coughing up blood',
      description:
        'Call emergency services immediately. Do not wait to contact the clinic first.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 365,
    },
    {
      title: 'Bleeding that soaks through dressings and does not stop with firm pressure',
      description:
        'Apply firm pressure and call emergency services. Do not drive yourself.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 365,
    },
    {
      title: 'Pain, swelling, warmth or redness in one calf or leg',
      description:
        'Possible sign of a blood clot. Contact the clinic straight away, or emergency services if you also feel breathless.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'A temperature of 38°C or above, or shaking chills',
      description: 'Contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 60,
    },
    {
      title: 'Pain that is getting worse rather than better',
      description:
        'Discomfort that increases after the first few days, or that your medication no longer controls, should be assessed.',
      severity: 'urgent',
      fromDay: 3,
      toDay: 60,
    },
    {
      title: 'A wound opening, or discharge with a smell',
      description: 'Cover it with a clean dressing and contact the clinic.',
      severity: 'call_clinic',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'Spreading redness or heat around the wound',
      description:
        'Redness that grows day to day rather than fading may be an infection starting.',
      severity: 'call_clinic',
      fromDay: 0,
      toDay: 90,
    },
    {
      title: 'Vomiting, or being unable to keep fluids down',
      description: 'Contact the clinic — staying hydrated matters for healing.',
      severity: 'call_clinic',
      fromDay: 0,
      toDay: 14,
    },
  ],
};

const NON_SURGICAL: SeedGuideBody = {
  expected: [
    {
      title: 'Redness, warmth or mild swelling at the treated area',
      description: 'Usually settles within the first few days.',
      fromDay: 0,
      toDay: 7,
    },
    {
      title: 'Small bruises where the skin was entered',
      description: 'Bruising can appear a day or two after treatment and fades over a week or so.',
      fromDay: 0,
      toDay: 14,
    },
    {
      title: 'Tenderness when the area is touched',
      description: 'Expected at first and should ease day by day.',
      fromDay: 0,
      toDay: 10,
    },
    {
      title: 'Dry, flaking or peeling skin after resurfacing treatments',
      description:
        'If your treatment worked on the skin surface, peeling is part of it. Do not pick at it.',
      fromDay: 1,
      toDay: 21,
    },
    {
      title: 'The final result taking time to appear',
      description:
        'Swelling can mask the outcome, and some treatments develop over weeks. Judging the result too early is the commonest reason for worry.',
      fromDay: 0,
      toDay: 90,
    },
  ],
  warning: [
    {
      title: 'Swelling of the lips, tongue or throat, or difficulty breathing',
      description:
        'Possible allergic reaction. Call emergency services immediately.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Any change to your vision',
      description:
        'Blurring, loss of vision or pain behind the eye after treatment needs emergency assessment. Call emergency services.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Skin near the treated area turning white, grey, blotchy or dusky',
      description:
        'Especially with severe or increasing pain. Contact the clinic immediately, and emergency services if you cannot reach them.',
      severity: 'emergency',
      fromDay: 0,
      toDay: 14,
    },
    {
      title: 'A temperature of 38°C or above',
      description: 'Contact the clinic the same day.',
      severity: 'urgent',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Redness or swelling that increases after the first few days',
      description: 'Rather than fading. May be an infection starting.',
      severity: 'urgent',
      fromDay: 3,
      toDay: 30,
    },
    {
      title: 'Blistering, crusting or open skin at the treated area',
      description: 'Keep it clean, do not pick, and contact the clinic.',
      severity: 'call_clinic',
      fromDay: 0,
      toDay: 30,
    },
    {
      title: 'Lumps, hardness or unevenness that is still there after two weeks',
      description: 'Worth reviewing at the clinic rather than waiting.',
      severity: 'call_clinic',
      fromDay: 14,
      toDay: 120,
    },
  ],
};

export const RECOVERY_GUIDE_SEED_EN: Record<SeedFamily, SeedGuideBody> = {
  surgical: SURGICAL,
  nonSurgical: NON_SURGICAL,
};
