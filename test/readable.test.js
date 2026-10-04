import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { candidates, generate, pick, readableBank } from '../src/generate.js';
import { EAR_LEVELS, STEPS, chains, earScript, phrases, story, threeSoundWords, twoSoundWords } from '../src/ladder.js';
import { STAGES, checkSentence, graphemesUpTo, isDecodable, parseGraphemes, segment } from '../src/phonics.js';
import { SHAPES, WORDS } from '../src/words.js';

const CLI = new URL('../src/cli.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('a word is readable only when every sound has been taught', () => {
  const two = graphemesUpTo(2); // s a t p i n m d
  assert.deepEqual(segment('sat', two), ['s', 'a', 't']);
  assert.equal(segment('cat', two), null); // c arrives in set 3
  assert.ok(isDecodable('pin', two));
  assert.ok(!isDecodable('dog', two));
});

test('a digraph has to be taught as a digraph', () => {
  const three = graphemesUpTo(3); // has c and k, not ck
  assert.equal(segment('duck', three), null);
  assert.equal(segment('sock', three), null); // every letter is known, but ck is one sound she has not met
  assert.equal(segment('sack', three), null);
  assert.deepEqual(segment('sock', graphemesUpTo(4)), ['s', 'o', 'ck']);
  assert.deepEqual(segment('duck', graphemesUpTo(4)), ['d', 'u', 'ck']);
  assert.equal(segment('bell', graphemesUpTo(4)), null); // l and ll arrive in set 5
  assert.deepEqual(segment('bell', graphemesUpTo(5)), ['b', 'e', 'll']);
  assert.equal(segment('bell', parseGraphemes('b,e,l')), null); // l alone does not unlock ll
  assert.deepEqual(segment('buzz', graphemesUpTo(7)), ['b', 'u', 'zz']);
});

test('sight words are allowed without sounding out', () => {
  const one = graphemesUpTo(1);
  assert.ok(isDecodable('the', one));
  assert.ok(!isDecodable('the', one, []));
  assert.ok(isDecodable('The', one));
});

test('bad input is refused', () => {
  assert.throws(() => graphemesUpTo(0), RangeError);
  assert.throws(() => graphemesUpTo(8), RangeError);
  assert.throws(() => graphemesUpTo(2.5), RangeError);
  assert.throws(() => parseGraphemes('s,a,7'));
  assert.equal(segment("can't", graphemesUpTo(7)), null);
});

test('checking a sentence names the words she cannot read yet', () => {
  const result = checkSentence('The cat is on the mat', graphemesUpTo(2));
  assert.deepEqual(result.filter((w) => !w.ok).map((w) => w.word), ['cat', 'on']);
  assert.ok(result.find((w) => w.word === 'The').tricky);
});

test('every word in the bank is regular by the final stage', () => {
  const all = graphemesUpTo(STAGES.length);
  for (const [kind, list] of Object.entries(WORDS)) {
    for (const word of list) assert.ok(isDecodable(word, all), `${kind}: ${word}`);
  }
  for (const shape of SHAPES) {
    for (const slot of shape) assert.ok(slot.startsWith('=') || WORDS[slot], `unknown slot ${slot}`);
  }
});

test('every generated sentence is readable at every stage, with and without "the"', () => {
  for (let stage = 1; stage <= STAGES.length; stage++) {
    for (const tricky of [['the'], []]) {
      const known = graphemesUpTo(stage);
      for (const c of candidates(known, { tricky, seed: stage, tries: 800 })) {
        const stuck = checkSentence(c.text, known, tricky).filter((w) => !w.ok);
        assert.deepEqual(stuck, [], `stage ${stage}: "${c.text}"`);
        assert.match(c.text, /^[A-Z][a-zA-Z ]+\.$/);
        assert.doesNotMatch(c.text, /\ba [aeiou]/i); // never "a egg"
      }
    }
  }
});

test('there is something to read from the second letter-set on', () => {
  // s a t p alone give names and "sat at", but nothing to sit on: no sentence yet, and the tool says so.
  assert.equal(candidates(graphemesUpTo(1), { tries: 800 }).length, 0);
  assert.ok(candidates(graphemesUpTo(2), { tries: 800 }).length >= 5);
  assert.ok(candidates(graphemesUpTo(4), { tries: 800 }).length >= 100);
  assert.ok(readableBank(graphemesUpTo(2)).thing.includes('pin'));
});

test('the same seed gives the same sentences', () => {
  const known = graphemesUpTo(4);
  const a = candidates(known, { seed: 7 }).map((c) => c.text);
  assert.deepEqual(a, candidates(known, { seed: 7 }).map((c) => c.text));
  assert.notDeepEqual(a, candidates(known, { seed: 8 }).map((c) => c.text));
});

test('the scorer decides the order, and no word takes over the page', async () => {
  const known = graphemesUpTo(4);
  // A stand-in for the model: shorter is "more natural".
  const { sentences } = await generate(known, { count: 8, surprise: async (s) => s.length, seed: 3 });
  assert.equal(sentences.length, 8);
  const ranks = sentences.map((s) => s.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b)); // best first, compared within its own shape
  const content = sentences.flatMap((s) => s.words.filter((w) => w.length > 2 && !['the', 'can'].includes(w)));
  assert.equal(new Set(content.map((w) => w.toLowerCase())).size, content.length);
  const shapes = sentences.map((s) => s.shape);
  assert.ok(new Set(shapes).size >= 4, `only shapes ${[...new Set(shapes)]}`); // not eight of the same pattern
});

test('a short pattern does not win just for being short', () => {
  // Shape 0 scores far lower (as short, common patterns do with a real model); shape 1 has the better sentence.
  const made = [
    { text: 'A.', words: ['aaa'], shape: 0, score: 1.0 }, { text: 'B.', words: ['bbb'], shape: 0, score: 1.1 },
    { text: 'C.', words: ['ccc'], shape: 0, score: 1.2 }, { text: 'D.', words: ['ddd'], shape: 1, score: 5.0 },
    { text: 'E.', words: ['eee'], shape: 1, score: 9.0 }, { text: 'F.', words: ['fff'], shape: 1, score: 9.2 },
  ];
  assert.equal(pick(made, 1)[0].text, 'D.');
});

test('with few letter-sounds the page is still filled', () => {
  const made = candidates(graphemesUpTo(2), { tries: 800 }).map((c) => ({ ...c, score: 1 }));
  assert.ok(made.length >= 5);
  assert.equal(pick(made, 5).length, 5); // words repeat rather than leaving the page short
});

test('focus puts the newest sound in front of her', () => {
  const made = candidates(graphemesUpTo(4), { seed: 2 }).map((c) => ({ ...c, score: 1 }));
  const chosen = pick(made, 3, { focus: ['ck'] });
  assert.ok(chosen.every((c) => c.words.some((w) => w.includes('ck'))), chosen.map((c) => c.text).join(' | '));
});

test('command line: readable sentences without the model', () => {
  const out = execFileSync(process.execPath, [CLI, '--stage', '3', '--count', '5', '--no-model', '--json'], { encoding: 'utf8' });
  const data = JSON.parse(out);
  assert.equal(data.sentences.length, 5);
  assert.equal(data.rankedByModel, false);
  const known = graphemesUpTo(3);
  for (const s of data.sentences) assert.ok(checkSentence(s.text, known).every((w) => w.ok), s.text);
});

test('progress is reported while sentences are scored', async () => {
  const seen = [];
  const { considered } = await generate(graphemesUpTo(3), { count: 3, surprise: async () => 1, tries: 60,
    onProgress: (done, total) => seen.push([done, total]) });
  assert.equal(seen.length, considered);
  assert.deepEqual(seen.at(-1), [considered, considered]);
});

test('command line: says it is working before the model is ready, and keeps --json clean', () => {
  const quiet = run('--stage', '3', '--count', '2', '--no-model', '--json');
  assert.equal(quiet.stderr, '');
  JSON.parse(quiet.stdout);
});

test('command line: check mode and errors', () => {
  const stuck = run('--check', 'The duck sat', '--stage', '3');
  assert.equal(stuck.status, 1);
  assert.match(stuck.stdout, /NOT\s+duck/);
  assert.equal(run('--check', 'Sam sat', '--stage', '2').status, 0);
  assert.equal(run('--stage', '9').status, 2);
  assert.equal(run('--stage', '2', '--count', '0', '--no-model').status, 2);
  assert.equal(run().status, 2);
  assert.match(run('--help').stdout, /Letter-sets, in teaching order/);
  assert.match(run('--letters', 's,a,t', '--no-model').stdout, /Nothing can be made/);
});

test('listening practice has no letters to read, only parts to say', () => {
  for (const level of Object.keys(EAR_LEVELS)) {
    const items = earScript(level, { count: 5 });
    assert.equal(items.length, 5, level);
    for (const item of items) assert.equal(item.say.join(''), item.word);
  }
  assert.ok(earScript('D').every((item) => item.say.length === 2));
  assert.ok(earScript('e').every((item) => item.say.length === 3));
  assert.ok(earScript('C').every((item) => item.say.length === 2 && item.say[0].length <= 2));
  assert.throws(() => earScript('Z'), RangeError);
});

test('two-sound words come before three-sound words', () => {
  const two = twoSoundWords(graphemesUpTo(2));
  assert.deepEqual(two.map((w) => w.word), ['at', 'in', 'am', 'it', 'an', 'is']);
  assert.ok(two.every((w) => w.sounds.length === 2));
  assert.deepEqual(twoSoundWords(graphemesUpTo(1)).map((w) => w.word), ['at']);
});

test('three-sound words are readable, and stretchy starts come first', () => {
  for (let stage = 2; stage <= STAGES.length; stage++) {
    const known = graphemesUpTo(stage);
    const words = threeSoundWords(known, { count: 40 });
    assert.ok(words.length >= 5, `stage ${stage}`);
    for (const w of words) {
      assert.equal(w.sounds.length, 3, w.word);
      assert.ok(isDecodable(w.word, known, []), `stage ${stage}: ${w.word}`);
    }
    const stretchy = words.map((w) => ['m', 's', 'n', 'f', 'l', 'r', 'v', 'z'].includes(w.sounds[0]));
    assert.ok(stretchy.indexOf(false) === -1 || !stretchy.slice(stretchy.indexOf(false)).includes(true), `stage ${stage}`);
  }
  assert.ok(!threeSoundWords(graphemesUpTo(3), { count: 60 }).some((w) => w.word.includes('ck')));
});

test('in a chain exactly one sound changes each time', () => {
  for (let stage = 2; stage <= STAGES.length; stage++) {
    const known = graphemesUpTo(stage);
    for (const chain of chains(known, { count: 4 })) {
      assert.ok(chain.length >= 3);
      assert.equal(new Set(chain).size, chain.length);
      for (let i = 1; i < chain.length; i++) {
        const [a, b] = [segment(chain[i - 1], known), segment(chain[i], known)];
        assert.ok(a && b, `stage ${stage}: ${chain[i - 1]} ${chain[i]}`);
        assert.equal(a.filter((sound, at) => sound !== b[at]).length, 1, chain.join(' '));
      }
    }
  }
});

test('phrases and stories use only what she can read', async () => {
  for (const stage of [2, 3, 5, 7]) {
    const known = graphemesUpTo(stage);
    const { sentences: made } = await phrases(known, { count: 6 });
    assert.ok(made.length >= 3, `stage ${stage}`);
    for (const p of made) {
      assert.ok(checkSentence(p.text, known).every((w) => w.ok), p.text);
      assert.doesNotMatch(p.text, /\.$/); // a phrase, not a sentence
    }
    const { sentences: lines, hero } = await story(known, { length: 5 });
    assert.ok(lines.length >= 3, `stage ${stage}`);
    assert.ok(lines.filter((l) => l.words[0] === hero).length >= 2, lines.map((l) => l.text).join(' '));
    for (const l of lines) assert.ok(checkSentence(l.text, known).every((w) => w.ok), l.text);
    assert.equal(new Set(lines.map((l) => l.text)).size, lines.length);
  }
});

test('the story keeps the sentence the model says follows best', async () => {
  // A stand-in model that likes the shortest story so far.
  const { sentences } = await story(graphemesUpTo(3), { length: 3, surprise: async (text) => text.length, seed: 4 });
  const { sentences: other } = await story(graphemesUpTo(3), { length: 3, surprise: async (text) => -text.length, seed: 4 });
  assert.ok(sentences.map((s) => s.text).join(' ').length < other.map((s) => s.text).join(' ').length);
});

test('command line: every step of the ladder runs', () => {
  assert.match(run('--ladder').stdout, /1\. ear[\s\S]*7\. story/);
  assert.match(run('--step', 'ear', '--ear', 'A').stdout, /You say: {2}\w+ {2}\.\.\. {2}\w+/);
  assert.match(run('--step', 'two', '--stage', '2').stdout, /at {5}a - t/);
  assert.match(run('--step', 'words', '--stage', '3').stdout, / - /);
  assert.match(run('--step', 'chain', '--stage', '3').stdout, /->/);
  assert.equal(run('--step', 'phrases', '--stage', '3', '--no-model').status, 0);
  assert.match(run('--step', 'story', '--stage', '3', '--no-model').stdout, /tells it back/);
  assert.equal(run('--step', 'nonsense', '--stage', '3').status, 2);
  assert.equal(run('--step', 'ear', '--ear', 'Q').status, 2);
  assert.equal(STEPS.length, 7);
});

test('the real model prefers sense to nonsense', { skip: process.env.READABLE_SKIP_MODEL === '1' }, async (t) => {
  let surprise;
  try {
    ({ surprise } = { surprise: await (await import('../src/scorer.js')).loadScorer() });
  } catch (error) {
    t.skip(`model not available: ${error.message.split('\n')[0]}`);
    return;
  }
  for (const [good, odd] of [['The cat sat on a mat.', 'The mat sat on a cat.'],
    ['A pig can dig in the mud.', 'A mud can pig in the dig.'], ['Sam had a nap in the sun.', 'Sun the in nap a had Sam.']]) {
    assert.ok(await surprise(good) < await surprise(odd), `${good} vs ${odd}`);
  }
});
