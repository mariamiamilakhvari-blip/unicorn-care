export const PROCEDURE_TYPES = [
  { key: 'rhinoplasty', ka: 'რინოპლასტიკა', en: 'Rhinoplasty' },
  { key: 'breast_augmentation', ka: 'მკერდის გადიდება', en: 'Breast augmentation' },
  { key: 'breast_lift', ka: 'მკერდის აწევა', en: 'Breast lift' },
  { key: 'breast_reduction', ka: 'მკერდის შემცირება', en: 'Breast reduction' },
  { key: 'liposuction', ka: 'ლიპოსაქცია', en: 'Liposuction' },
  { key: 'abdominoplasty', ka: 'აბდომინოპლასტიკა', en: 'Abdominoplasty' },
  { key: 'blepharoplasty', ka: 'ბლეფაროპლასტიკა', en: 'Blepharoplasty' },
  { key: 'facelift', ka: 'სახის აწევა', en: 'Facelift' },
  { key: 'otoplasty', ka: 'ოტოპლასტიკა', en: 'Otoplasty' },
  { key: 'gynecomastia_surgery', ka: 'გინეკომასტიის ოპერაცია', en: 'Gynecomastia surgery' },
  { key: 'brazilian_butt_lift', ka: 'დუნდულოების პლასტიკა (BBL)', en: 'Brazilian butt lift' },
  { key: 'hair_transplant', ka: 'თმის გადანერგვა', en: 'Hair transplant' },
  { key: 'botox_injection', ka: 'ბოტოქსის ინექცია', en: 'Botox injection' },
  { key: 'dermal_filler', ka: 'დერმალური ფილერი', en: 'Dermal filler' },
  { key: 'chemical_peel', ka: 'ქიმიური პილინგი', en: 'Chemical peel' },
  { key: 'laser_resurfacing', ka: 'ლაზერული რეზურფესინგი', en: 'Laser resurfacing' },
  { key: 'thread_lift', ka: 'ძაფებით აწევა', en: 'Thread lift' },
  { key: 'other', ka: 'სხვა', en: 'Other' },
] as const;

export const ANESTHESIA_TYPES = [
  { key: 'general', ka: 'ზოგადი ნარკოზი', en: 'General' },
  { key: 'regional', ka: 'რეგიონული ანესთეზია', en: 'Regional' },
  { key: 'local', ka: 'ადგილობრივი ანესთეზია', en: 'Local' },
  { key: 'sedation', ka: 'სედაცია', en: 'Sedation' },
  { key: 'none', ka: 'ანესთეზიის გარეშე', en: 'None' },
] as const;

export const INTENSITY_LEVELS = [
  { key: 'light', ka: 'მსუბუქი', en: 'Light' },
  { key: 'moderate', ka: 'საშუალო', en: 'Moderate' },
  { key: 'intense', ka: 'ინტენსიური', en: 'Intense' },
] as const;

export const MEDICATION_ROUTES = [
  { key: 'oral', ka: 'პერორალური', en: 'Oral' },
  { key: 'topical', ka: 'გარეგანი', en: 'Topical' },
  { key: 'injection', ka: 'ინექცია', en: 'Injection' },
  { key: 'other', ka: 'სხვა', en: 'Other' },
] as const;

export type ProcedureTypeKey = (typeof PROCEDURE_TYPES)[number]['key'];
export type AnesthesiaTypeKey = (typeof ANESTHESIA_TYPES)[number]['key'];
export type IntensityLevelKey = (typeof INTENSITY_LEVELS)[number]['key'];
export type MedicationRouteKey = (typeof MEDICATION_ROUTES)[number]['key'];
