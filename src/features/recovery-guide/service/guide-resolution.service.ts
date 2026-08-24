/**
 * How a clinic's own guide and the platform default combine into what one patient reads.
 *
 * Per list, not per document. A guide is two independent lists — "what is normal" and "when to
 * call" — and a clinic writing one of them has not thereby said anything about the other. The
 * resolution used to pick a whole row, which made a clinic that filled in only its red flags
 * publish a guide with no expected signs at all: their row won, and its empty `expected` came with
 * it. Splitting the choice is what lets a clinic write the half it has an opinion about.
 *
 * Non-empty is the test, and deliberately not "the row exists". An empty list is not a clinical
 * statement that nothing is normal after this operation; it is a list nobody filled in.
 *
 * The halves are never mixed within one list. A clinic that wrote three red flags gets those three
 * and not the platform's seven underneath them — that is the "alongside" this replaces, where a
 * patient could not tell which lines their own surgeon had written. Anything a clinic has said on
 * a subject is the whole of what the patient is shown on that subject.
 */
export function resolveGuideList<T>(own: readonly T[] | undefined, fallback: readonly T[] | undefined): T[] {
  if (own && own.length > 0) return [...own];
  return [...(fallback ?? [])];
}

type GuideBody<E, W> = { expected?: readonly E[]; warning?: readonly W[] };

/** Both lists resolved together, and whether anything of the clinic's own survived the choice. */
export function resolveGuideBody<E, W>(
  own: GuideBody<E, W> | null,
  fallback: GuideBody<E, W> | null
): { expected: E[]; warning: W[]; usedOwn: boolean } {
  const expected = resolveGuideList(own?.expected, fallback?.expected);
  const warning = resolveGuideList(own?.warning, fallback?.warning);

  /*
    "Did the clinic write any of this", which is what the portal's `isDefault` flag means to a
    reader. A clinic row holding two empty lists is not authorship, so it does not count — the
    patient would be told their clinic wrote content that came from the platform.
  */
  const usedOwn = Boolean(
    (own?.expected?.length ?? 0) > 0 || (own?.warning?.length ?? 0) > 0
  );

  return { expected, warning, usedOwn };
}
