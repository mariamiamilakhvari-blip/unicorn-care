/**
 * Mkhedruli to Latin, by the Georgian national system (2002) — the one on passports and road
 * signs, so a clinic reading the suggestion recognises it as the spelling of their own name they
 * have seen before.
 *
 * The system is lossy on purpose and the collisions are its own: თ and ტ both give `t`, ფ and პ
 * both `p`, ქ and კ both `k`, ც and წ both `ts`, ჩ and ჭ both `ch`. Reversibility is not what this
 * is for. A clinic reads the result and corrects it, which is the only reason it is safe to
 * generate at all.
 */
const MKHEDRULI_TO_LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't',
  ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh',
  რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q',
  შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j',
  ჰ: 'h',
};

/** Anything already Latin, numeric or punctuation passes through untouched — `N40` stays `N40`. */
function letter(character: string): string {
  return MKHEDRULI_TO_LATIN[character] ?? character;
}

/**
 * Georgian has no capital letters, so a straight transliteration of a clinic's name arrives
 * entirely lowercase and reads like a mistake rather than like a name. Each word therefore starts
 * upper — the clinic is going to edit this anyway, and "Gaguas Klinika" is a better thing to edit
 * than "gaguas klinika".
 *
 * Only the first character is touched. Forcing the rest down would flatten `N40` to `N40` → `n40`
 * and mangle any Latin the clinic had already typed into the Georgian field.
 */
function capitaliseWords(value: string): string {
  return value.replace(/(^|[\s\-–—([/])(\p{Ll})/gu, (_, boundary: string, first: string) =>
    `${boundary}${first.toUpperCase()}`
  );
}

/**
 * A Latin suggestion for a Georgian name or address, for a clinic to accept or rewrite.
 *
 * Never used as a translation and never written without being shown. A clinic's English name is
 * whatever that clinic says it is — a transliteration, a trading name, sometimes neither — so this
 * only ever pre-fills a visible, editable field. The address in particular will need a human: this
 * turns `გამზ.` into `gamz.`, which is the abbreviation transliterated rather than the word
 * "Avenue", and no mapping table can know that.
 *
 * Returns an empty string for empty input, so a caller can treat "nothing to suggest" and "nothing
 * typed yet" as the same case.
 */
export function transliterateGeorgian(value: string): string {
  if (!value.trim()) return '';

  const latin = [...value].map(letter).join('');
  return capitaliseWords(latin);
}

/**
 * Whether a suggestion may be written into `target`.
 *
 * Only into an empty one. A clinic that has typed its own English name has answered the question
 * this feature exists to ask, and re-answering it on their behalf every time they touch the
 * Georgian field would be the feature actively destroying their work. Whitespace counts as empty:
 * a field opened, spaced and abandoned holds `' '`, which is truthy and would otherwise lock the
 * suggestion out forever.
 */
export function canSuggest(target: string): boolean {
  return target.trim().length === 0;
}
