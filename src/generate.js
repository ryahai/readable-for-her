// Build sentences out of words the child can read, then let the model say
// which ones make sense. The rules guarantee every word is readable; the
// model does the part rules cannot: "A pig can dig" over "A mat can dig".
import { DEFAULT_TRICKY, isDecodable } from './phonics.js';
import { SHAPES, WORDS } from './words.js';

// Small seeded generator so a run can be repeated exactly.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The part of the word bank this child can read today.
export function readableBank(known, tricky = DEFAULT_TRICKY) {
  const bank = {};
  for (const [kind, list] of Object.entries(WORDS)) {
    bank[kind] = list.filter((w) => isDecodable(w, known, tricky));
  }
  return bank;
}

function fill(shapeIndex, bank, known, tricky, random, shapes, sentence) {
  const shape = shapes[shapeIndex];
  const words = [];
  for (const slot of shape) {
    if (slot.startsWith('=')) {
      const literal = slot.slice(1);
      if (!isDecodable(literal, known, tricky)) return null;
      words.push(literal);
      continue;
    }
    const options = bank[slot];
    if (!options.length) return null;
    words.push(options[Math.floor(random() * options.length)]);
  }
  // "a" before a vowel sound reads wrongly ("a egg"), and repeating a word is dull.
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'a' && /^[aeiou]/.test(words[i + 1])) return null;
  }
  const content = words.filter((w) => !['a', 'the', 'can', 'is'].includes(w));
  if (new Set(content.map((w) => w.toLowerCase())).size !== content.length) return null;
  const text = words.join(' ');
  // A sentence gets a capital and a full stop; a phrase is left as it is.
  return { text: sentence ? text[0].toUpperCase() + text.slice(1) + '.' : text, words, shape: shapeIndex };
}

export function candidates(known, { tricky = DEFAULT_TRICKY, seed = 1, tries = 600, shapes = SHAPES,
  sentence = true } = {}) {
  const bank = readableBank(known, tricky);
  const random = rng(seed);
  const seen = new Map();
  for (let i = 0; i < tries; i++) {
    const made = fill(Math.floor(random() * shapes.length), bank, known, tricky, random, shapes, sentence);
    if (made && !seen.has(made.text)) seen.set(made.text, made);
  }
  return [...seen.values()];
}

// A language model finds short, common patterns least surprising, so raw
// scores would fill the page with "X is on the Y". Each sentence is instead
// compared with others of its own shape: how much better than a typical
// sentence built the same way?
export function withinShape(scored) {
  const groups = new Map();
  for (const c of scored) groups.set(c.shape, [...(groups.get(c.shape) ?? []), c]);
  const out = [];
  for (const group of groups.values()) {
    const mean = group.reduce((sum, c) => sum + c.score, 0) / group.length;
    const spread = Math.sqrt(group.reduce((sum, c) => sum + (c.score - mean) ** 2, 0) / group.length) || 1;
    for (const c of group) out.push({ ...c, rank: (c.score - mean) / spread });
  }
  return out;
}

const contentWords = (c) => c.words.filter((w) => w.length > 2 && !['the', 'can'].includes(w)).map((w) => w.toLowerCase());

// Keep the best sentences, but do not let one word or one shape take over the page.
export function pick(scored, count, { focus = [] } = {}) {
  const ranked = withinShape(scored).sort((a, b) => a.rank - b.rank);
  const perShape = Math.max(1, Math.ceil(count / 4));
  const wordUse = new Map();
  const shapeUse = new Map();
  const chosen = [];
  const hasFocus = (c) => !focus.length || c.words.some((w) => focus.some((g) => w.toLowerCase().includes(g)));
  // Strictest first; the rules loosen only if the page cannot be filled.
  const passes = [
    { needFocus: true, wordLimit: 1, shapeLimit: perShape },
    { needFocus: false, wordLimit: 1, shapeLimit: perShape },
    { needFocus: false, wordLimit: 2, shapeLimit: count },
    { needFocus: false, wordLimit: count, shapeLimit: count },
  ];
  for (const { needFocus, wordLimit, shapeLimit } of passes) {
    for (const c of ranked) {
      if (chosen.length >= count) break;
      if (chosen.includes(c) || (needFocus && !hasFocus(c))) continue;
      if ((shapeUse.get(c.shape) ?? 0) >= shapeLimit) continue;
      const words = contentWords(c);
      if (words.some((w) => (wordUse.get(w) ?? 0) >= wordLimit)) continue;
      words.forEach((w) => wordUse.set(w, (wordUse.get(w) ?? 0) + 1));
      shapeUse.set(c.shape, (shapeUse.get(c.shape) ?? 0) + 1);
      chosen.push(c);
    }
  }
  return chosen;
}

// surprise(sentence) -> number, lower is more natural. Pass null to skip the model.
// onProgress(done, total) is called as sentences are scored, so a caller can show it is alive.
export async function generate(known, { count = 10, tricky = DEFAULT_TRICKY, seed = 1, focus = [], surprise = null,
  tries = 600, onProgress = null, shapes = SHAPES, sentence = true } = {}) {
  const made = candidates(known, { tricky, seed, tries, shapes, sentence });
  const scored = [];
  for (const c of made) {
    scored.push({ ...c, score: surprise ? await surprise(c.text) : 0 });
    if (surprise && onProgress) onProgress(scored.length, made.length);
  }
  return { sentences: pick(scored, count, { focus }), considered: made.length };
}
