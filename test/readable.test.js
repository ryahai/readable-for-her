import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { candidates, generate, pick, readableBank } from '../src/generate.js';
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
  assert.match(run('--letters', 's,a,t', '--no-model').stdout, /No sentences can be made/);
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
