/**
 * The bounds a patient's age is accepted within.
 *
 * Zero is a real answer — a neonate has an age, and rejecting it would make the field unusable
 * for the one patient group whose dosing depends on it most. The ceiling is a typo guard rather
 * than a claim about human lifespan: it catches a birth year typed into an age box, which is the
 * mistake this field actually attracts.
 *
 * Age is stored as the clinic entered it and never recomputed, because nothing here knows the
 * birth date it came from. A record entered today reads the same twelve months from now, so a
 * clinic re-reading an old patient is reading the age at intake, not the age today.
 */
export const MIN_PATIENT_AGE = 0;
export const MAX_PATIENT_AGE = 120;
