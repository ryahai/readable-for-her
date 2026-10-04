// The ladder: from hearing sounds to reading a short story.
//
// A child who cannot yet blend sounds by ear will not blend them from print,
// so the ladder starts with listening and only then moves to letters:
//
//   ear        say it together, no letters: the grown-up says the parts, she says the word
//   two        two-sound words in print (at, in, am)
//   words      three-sound words, sounded out; words that start with a stretchy sound come first
//   chain      change one sound at a time (sat, sit, sip, tip)
//   phrases    two or three words (a red hat)
//   sentences  one sentence at a time
//   story      a few sentences about the same person: actual reading
//
// The grown-up decides when to move up. The rule of thumb printed with each
// step is the one from the home routine this follows: four out of five
// without help, on two different days.
import { candidates, generate, rng } from './generate.js';
import { DEFAULT_TRICKY, isDecodable, segment } from './phonics.js';
import { WORDS } from './words.js';

export const STEPS = ['ear', 'two', 'words', 'chain', 'phrases', 'sentences', 'story'];

export const ABOUT = {
  ear: 'Say it together. No letters. You say the parts with a gap, she says the whole word.',
  two: 'Two-sound words. Point under each sound, she says each sound, then the word.',
  words: 'Three-sound words. Stretch the first sound, then say the word. Stretchy starts come first.',
  chain: 'One sound changes each time. Ask: "What changed?" before she reads the new word.',
  phrases: 'Short phrases. She reads each word, then says the phrase again smoothly.',
  sentences: 'One sentence at a time. She reads it, then tells you what happened.',
  story: 'A short story about one person. She reads it through, then tells it back in her own words.',
};
export const MOVE_UP = 'Move up when she gets four out of five without help, on two different days. You decide.';

// Listening steps, biggest pieces first. Each item: the parts you say, and the word she should say.
export const EAR_LEVELS = {
  A: { name: 'two words joined', items: [['rain', 'bow'], ['sun', 'set'], ['cup', 'cake'], ['foot', 'ball'], ['bed', 'time'], ['pop', 'corn'], ['bath', 'tub'], ['star', 'fish']] },
  B: { name: 'two beats', items: [['ta', 'ble'], ['ti', 'ger'], ['ba', 'by'], ['pa', 'per'], ['mon', 'key'], ['win', 'dow'], ['ro', 'bot'], ['pup', 'py']] },
  C: { name: 'first sound, then the rest', items: null },
  D: { name: 'two sounds', items: [['a', 'm'], ['i', 'n'], ['a', 't'], ['u', 'p'], ['o', 'n'], ['i', 't'], ['a', 'n'], ['i', 'f']] },
  E: { name: 'three sounds', items: null },
};

const TWO_SOUND = ['at', 'in', 'am', 'it', 'on', 'up', 'an', 'is', 'if', 'us'];
// Sounds you can hold and stretch (mmm, sss): the easiest to blend from.
const STRETCHY = new Set(['m', 's', 'n', 'f', 'l', 'r', 'v', 'z']);
const ALL = new Set('abcdefghijklmnopqrstuvwxyz'.split('').concat(['ck', 'ff', 'll', 'ss', 'zz', 'qu']));

function shuffle(list, seed) {
  const random = rng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Every plain word in the bank, once, with its sounds.
function bankWords() {
  const seen = new Map();
  for (const kind of ['who', 'thing', 'place', 'feeling', 'look', 'didAlone', 'didTo', 'canDo']) {
    for (const w of WORDS[kind]) if (!seen.has(w)) seen.set(w, segment(w, ALL));
  }
  return [...seen].map(([word, sounds]) => ({ word, sounds }));
}

export function earScript(level, { seed = 1, count = 5 } = {}) {
  const key = String(level).toUpperCase();
  if (!EAR_LEVELS[key]) throw new RangeError('listening level must be A, B, C, D or E');
  let items = EAR_LEVELS[key].items;
  if (key === 'C') items = bankWords().filter((w) => w.sounds.length === 3).map((w) => [w.sounds[0], w.sounds.slice(1).join('')]);
  if (key === 'E') items = bankWords().filter((w) => w.sounds.length === 3).map((w) => w.sounds);
  return shuffle(items, seed).slice(0, count).map((parts) => ({ say: parts, word: parts.join('') }));
}

export function twoSoundWords(known, { tricky = DEFAULT_TRICKY } = {}) {
  return TWO_SOUND.filter((w) => isDecodable(w, known, []) && segment(w, known).length === 2)
    .map((word) => ({ word, sounds: segment(word, known) }));
}

export function threeSoundWords(known, { seed = 1, count = 10 } = {}) {
  const all = bankWords().filter((w) => w.sounds.length === 3 && isDecodable(w.word, known, []));
  const mixed = shuffle(all, seed);
  const easyFirst = [...mixed.filter((w) => STRETCHY.has(w.sounds[0])), ...mixed.filter((w) => !STRETCHY.has(w.sounds[0]))];
  return easyFirst.slice(0, count).map((w) => ({ word: w.word, sounds: segment(w.word, known) }));
}

// Chains of three-sound words where exactly one sound changes each step.
export function chains(known, { seed = 1, count = 3, length = 5 } = {}) {
  const pool = bankWords().filter((w) => w.sounds.length === 3 && isDecodable(w.word, known, []));
  const oneApart = (a, b) => a.sounds.filter((s, i) => s !== b.sounds[i]).length === 1;
  const out = [];
  const used = new Set();
  for (const start of shuffle(pool, seed)) {
    if (out.length >= count) break;
    if (used.has(start.word)) continue;
    const chain = [start];
    const inChain = new Set([start.word]);
    while (chain.length < length) {
      const next = shuffle(pool, seed + chain.length).find((w) => !inChain.has(w.word) && !used.has(w.word) && oneApart(chain.at(-1), w));
      if (!next) break;
      chain.push(next);
      inChain.add(next.word);
    }
    if (chain.length >= 3) {
      chain.forEach((w) => used.add(w.word));
      out.push(chain.map((w) => w.word));
    }
  }
  return out;
}

const PHRASE_SHAPES = [
  ['determiner', 'look', 'thing'],
  ['determiner', 'feeling', 'who'],
  ['where', 'determiner', 'place'],
  ['determiner', 'who', '=and', 'determiner', 'who'],
  ['name', '=and', 'name'],
  ['determiner', 'thing', 'where', 'determiner', 'place'],
];

export async function phrases(known, { count = 8, tricky = DEFAULT_TRICKY, seed = 1, surprise = null, onProgress = null,
  tries = 300 } = {}) {
  return generate(known, { count, tricky, seed, surprise, onProgress, shapes: PHRASE_SHAPES, sentence: false, tries });
}

// A story is a handful of sentences about one named person. The model reads
// the story so far together with each possible next sentence, and the one
// that follows most naturally is kept.
export async function story(known, { length = 5, tricky = DEFAULT_TRICKY, seed = 1, surprise = null, onProgress = null,
  perStep = 18 } = {}) {
  const all = candidates(known, { tricky, seed, tries: 900 });
  const names = WORDS.name.filter((n) => all.filter((c) => c.words[0] === n).length >= 3);
  if (!names.length) return { sentences: [], hero: null };
  const hero = shuffle(names, seed)[0];
  const lines = [];
  const usedShapes = new Map();
  const total = length * perStep;
  let done = 0;
  for (let i = 0; i < length; i++) {
    const soFar = new Set(lines.flatMap((l) => l.words.filter((w) => w.length > 2).map((w) => w.toLowerCase())));
    // About the hero, or about something already in the story. Never about a second named person.
    const mentions = (c) => c.words.some((w) => w.length > 2 && soFar.has(w.toLowerCase()) && !WORDS.name.includes(w));
    // Each sentence has to bring something new, or the story just repeats itself.
    // A language model likes repetition, so two rules stop it: a sentence must
    // end somewhere new, and must not be built like the one before it.
    const fresh = (c) => !soFar.has(c.words.at(-1).toLowerCase()) && c.shape !== lines.at(-1)?.shape;
    const about = all.filter((c) => !lines.some((l) => l.text === c.text) && fresh(c) && (usedShapes.get(c.shape) ?? 0) < 2
      && !c.words.some((w) => WORDS.name.includes(w) && w !== hero)
      && (c.words[0] === hero || (i > 0 && i % 3 === 2 && mentions(c))));
    const options = shuffle(about, seed + i).slice(0, perStep);
    if (!options.length) break;
    let best = null;
    for (const c of options) {
      const text = [...lines.map((l) => l.text), c.text].join(' ');
      const score = surprise ? await surprise(text) : 0;
      done += 1;
      if (surprise && onProgress) onProgress(Math.min(done, total), total);
      if (!best || score < best.score) best = { ...c, score };
    }
    lines.push(best);
    usedShapes.set(best.shape, (usedShapes.get(best.shape) ?? 0) + 1);
  }
  if (surprise && onProgress) onProgress(total, total);
  return { sentences: lines, hero };
}
