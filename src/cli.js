#!/usr/bin/env node
// readable: practice sentences a beginner reader can sound out, one letter-set at a time.
import { parseArgs } from 'node:util';
import { generate } from './generate.js';
import { DEFAULT_TRICKY, STAGES, checkSentence, graphemesUpTo, parseGraphemes } from './phonics.js';

const HELP = `readable - sentences a beginner reader can actually sound out

  readable --stage 3                 ten sentences using the first three letter-sets
  readable --letters s,a,t,p,i,n     use exactly these letter-sounds instead
  readable --stage 4 --focus ck      prefer sentences that practise "ck"
  readable --check "The cat is on the mat" --stage 2
                                     show which words she cannot read yet

  --count N      how many sentences (default 10)
  --tricky a,b   sight words she knows (default: the)
  --seed N       repeat a run exactly (default 1)
  --no-model     skip the language model; sentences are readable but not ranked for sense
  --offline      never contact the network; needs the model already downloaded once
  --model ID     another open-weight model from Hugging Face (default SmolLM2-135M)
  --json         machine-readable output

Letter-sets, in teaching order:
${STAGES.map((set, i) => `  ${i + 1}: ${set.join(' ')}`).join('\n')}
`;

const { values: opt } = parseArgs({
  options: {
    stage: { type: 'string' }, letters: { type: 'string' }, count: { type: 'string', default: '10' },
    tricky: { type: 'string' }, seed: { type: 'string', default: '1' }, focus: { type: 'string' },
    check: { type: 'string' }, model: { type: 'string' }, 'no-model': { type: 'boolean', default: false },
    offline: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message) {
  console.error(`readable: ${message}\nTry: readable --help`);
  process.exit(2);
}

if (opt.help || (!opt.stage && !opt.letters)) {
  console.log(HELP);
  process.exit(opt.help ? 0 : 2);
}

let known;
try {
  known = opt.letters ? parseGraphemes(opt.letters) : graphemesUpTo(Number(opt.stage));
} catch (error) {
  fail(error.message);
}
const tricky = opt.tricky === undefined ? DEFAULT_TRICKY : opt.tricky.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
const count = Number(opt.count);
const seed = Number(opt.seed);
if (!Number.isInteger(count) || count < 1 || count > 100) fail('--count must be a whole number from 1 to 100');
if (!Number.isInteger(seed)) fail('--seed must be a whole number');

if (opt.check !== undefined) {
  const words = checkSentence(opt.check, known, tricky);
  const stuck = words.filter((w) => !w.ok);
  if (opt.json) {
    console.log(JSON.stringify({ sentence: opt.check, readable: stuck.length === 0, words }, null, 2));
  } else {
    for (const w of words) {
      console.log(`${w.ok ? 'ok ' : 'NOT'}  ${w.word.padEnd(12)} ${w.tricky ? '(sight word)' : w.graphemes ? w.graphemes.join('-') : 'uses a sound she has not met'}`);
    }
    console.log(stuck.length ? `\n${stuck.length} word(s) she cannot sound out yet.` : '\nShe can read every word.');
  }
  process.exit(stuck.length ? 1 : 0);
}

// Progress goes to the error stream so it shows straight away and never mixes into --json output.
const note = (text) => process.stderr.write(text);

let surprise = null;
if (!opt['no-model']) {
  note('Loading the language model. The first run downloads about 120 MB; on a busy laptop this can take a minute...\n');
  const { loadScorer, DEFAULT_MODEL } = await import('./scorer.js');
  try {
    surprise = await loadScorer(opt.model ?? DEFAULT_MODEL, { offline: opt.offline });
  } catch (error) {
    fail(`could not load the language model (${error.message.split('\n')[0]}). ` +
      'Run once with a connection to download it, or add --no-model.');
  }
}

const focus = opt.focus ? opt.focus.toLowerCase().split(',').map((g) => g.trim()).filter(Boolean) : [];
const onProgress = (done, total) => {
  if (done === 1 || done % 20 === 0 || done === total) {
    note(`${String.fromCharCode(13)}Choosing the sentences that make sense: ${done} of ${total} read`);
  }
  if (done === total) note(String.fromCharCode(10, 10));
};
const { sentences, considered } = await generate(known, { count, tricky, seed, focus, surprise, onProgress });

if (opt.json) {
  console.log(JSON.stringify({
    letterSounds: [...known], sightWords: tricky, rankedByModel: Boolean(surprise), considered,
    sentences: sentences.map((s) => ({ text: s.text, surprise: Number(s.score.toFixed(3)) })),
  }, null, 2));
} else if (!sentences.length) {
  console.log('No sentences can be made from these letter-sounds yet. Add another set, or a sight word with --tricky.');
} else {
  console.log(`Letter-sounds: ${[...known].join(' ')}   Sight words: ${tricky.join(' ') || '(none)'}`);
  console.log(surprise ? `Ranked for sense by a local model, best first (${considered} considered):\n`
    : `Not ranked: --no-model (${considered} considered):\n`);
  sentences.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.text}`));
}
process.exit(sentences.length || opt.json ? 0 : 1);
