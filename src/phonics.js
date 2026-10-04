// Which words can a beginner sound out? A word is decodable when it can be
// split, left to right, into letter-sounds (graphemes) the child has been
// taught. "duck" needs d, u and ck; knowing c and k separately is not enough.

// The order most UK synthetic-phonics programmes teach first sounds in
// (Letters and Sounds, Phase 2 sets 1-5 and Phase 3 sets 6-7).
export const STAGES = [
  ['s', 'a', 't', 'p'],
  ['i', 'n', 'm', 'd'],
  ['g', 'o', 'c', 'k'],
  ['ck', 'e', 'u', 'r'],
  ['h', 'b', 'f', 'ff', 'l', 'll', 'ss'],
  ['j', 'v', 'w', 'x'],
  ['y', 'z', 'zz', 'qu'],
];

// Words taught by sight because they do not sound out regularly.
export const DEFAULT_TRICKY = ['the'];

export function graphemesUpTo(stage) {
  if (!Number.isInteger(stage) || stage < 1 || stage > STAGES.length) {
    throw new RangeError(`stage must be a whole number from 1 to ${STAGES.length}`);
  }
  return new Set(STAGES.slice(0, stage).flat());
}

export function parseGraphemes(text) {
  const list = text.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (list.some((g) => !/^[a-z]{1,3}$/.test(g))) throw new Error('letter-sounds must be 1-3 letters each, e.g. "s,a,t,ck"');
  return new Set(list);
}

// Split a word into known graphemes, or return null if it cannot be done.
// Backtracks, so "kiss" tries k-i-ss as well as k-i-s-s.
export function segment(word, known) {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w)) return null;
  const longest = Math.max(1, ...[...known].map((g) => g.length));
  const walk = (at) => {
    if (at === w.length) return [];
    // Two letters that make one sound must be read as one sound. If she has
    // not been taught it, the word is out of reach: "sock" is not s-o-c-k.
    const pair = w.slice(at, at + 2);
    if (DIGRAPHS.has(pair)) {
      if (!known.has(pair)) return null;
      const rest = walk(at + 2);
      return rest ? [pair, ...rest] : null;
    }
    for (let size = Math.min(longest, w.length - at); size >= 1; size--) {
      const piece = w.slice(at, at + size);
      if (!known.has(piece)) continue;
      const rest = walk(at + size);
      if (rest) return [piece, ...rest];
    }
    return null;
  };
  return walk(0);
}
// Letter pairs that always stand for a single sound in the words this tool uses.
const DIGRAPHS = new Set(['ck', 'ff', 'll', 'ss', 'zz', 'qu']);

export function isDecodable(word, known, tricky = DEFAULT_TRICKY) {
  return tricky.includes(word.toLowerCase()) || segment(word, known) !== null;
}

// Every word of a sentence, with whether the child can read it yet.
export function checkSentence(sentence, known, tricky = DEFAULT_TRICKY) {
  const words = sentence.match(/[A-Za-z]+/g) ?? [];
  return words.map((word) => {
    const isTricky = tricky.includes(word.toLowerCase());
    const parts = isTricky ? null : segment(word, known);
    return { word, ok: isTricky || parts !== null, tricky: isTricky, graphemes: parts };
  });
}
