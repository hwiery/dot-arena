// Hangul jamo checks for the "forbidden consonant" game (spelling-based, not pronunciation).
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// Compound and double consonants contain their parts: ㄺ uses ㄹ, ㄲ uses ㄱ.
const PARTS = {
  'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ',
  'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ',
  'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
};

export const FORBIDDEN_CHOICES = ['ㄹ', 'ㄴ', 'ㄱ', 'ㅁ', 'ㅅ'];

export function isSyllable(ch) {
  const c = ch.codePointAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}

export function consonantsOf(ch) {
  const s = ch.codePointAt(0) - 0xac00;
  const out = [CHO[Math.floor(s / 588)]];
  const jong = JONG[s % 28];
  if (jong) out.push(jong);
  return out.flatMap((j) => [j, ...(PARTS[j] ?? '')]);
}

export function usesConsonant(text, jamo) {
  return [...text].some((ch) => isSyllable(ch) && consonantsOf(ch).includes(jamo));
}

// Returns { ok, reason, normalized }. An answer is 2–20 Hangul syllables (spaces allowed)
// with no syllable that spells the forbidden consonant.
export function checkAnswer(raw, jamo) {
  const normalized = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const letters = [...normalized.replace(/ /g, '')];
  if (letters.length < 2) return { ok: false, reason: 'short', normalized };
  if (letters.length > 20) return { ok: false, reason: 'long', normalized };
  if (!letters.every(isSyllable)) return { ok: false, reason: 'not-hangul', normalized };
  if (usesConsonant(normalized, jamo)) return { ok: false, reason: 'forbidden', normalized };
  return { ok: true, reason: null, normalized };
}
