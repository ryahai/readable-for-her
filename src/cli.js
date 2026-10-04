#!/usr/bin/env node
// readable: reading practice a beginner can actually sound out, one step of the ladder at a time.
import { parseArgs } from 'node:util';
import { generate } from './generate.js';
import { ABOUT, EAR_LEVELS, MOVE_UP, STEPS, chains, earScript, phrases, story, threeSoundWords, twoSoundWords } from './ladder.js';
import { DEFAULT_TRICKY, STAGES, checkSentence, graphemesUpTo, parseGraphemes } from './phonics.js';

const HELP = `readable - reading practice a beginner can actually sound out

  readable --stage 3                 ten sentences using the first three letter-sets
  readable --letters s,a,t,p,i,n     use exactly these letter-sounds instead
  readable --stage 4 --focus ck      prefer sentences that practise "ck"
  readable --check "The cat is on the mat" --stage 2
                                     show which words she cannot read yet

The ladder, from hearing sounds to reading a story (--ladder explains each step):
  readable --step ear --ear D            say it together, no letters (levels A to E)
  readable --step two --stage 2          two-sound words: at, in, am
  readable --step words --stage 3        three-sound words, sounded out
  readable --step chain --stage 3        one sound changes each time
  readable --step phrases --stage 3      a red hat
  readable --step sentences --stage 3    one sentence at a time (the default)
  readable --step story --stage 3        a short story about one person

  --count N      how many lines (default 10)
  --tricky a,b   sight words she knows (default: the)
  --seed N       repeat a run exactly (default 1); change it for a fresh page
  --no-model     skip the language model; lines are readable but not ranked for sense
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
    check: { type: 'string' }, model: { type: 'string' }, step: { type: 'string', default: 'sentences' },
    ear: { type: 'string', default: 'D' }, ladder: { type: 'boolean', default: false },
    'no-model': { type: 'boolean', default: false }, offline: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false },
  },
});

function fail(message) {
  console.error(`readable: ${message}\nTry: readable --help`);
  process.exit(2);
}

const count = Number(opt.count);
const seed = Number(opt.seed);
if (!Number.isInteger(count) || count < 1 || count > 100) fail('--count must be a whole number from 1 to 100');
if (!Number.isInteger(seed)) fail('--seed must be a whole number');
if (!STEPS.includes(opt.step)) fail(`--step must be one of: ${STEPS.join(', ')}`);

if (opt.help) {
  console.log(HELP);
  process.exit(0);
}

if (opt.ladder) {
  console.log('The ladder, easiest first. Start at the first step she cannot do yet.\n');
  STEPS.forEach((step, i) => console.log(`${i + 1}. ${step.padEnd(10)} ${ABOUT[step]}`));
  const levels = Object.entries(EAR_LEVELS).map(([key, level]) => `${key} ${level.name}`).join(', ');
  console.log(`\nListening levels for --step ear: ${levels}.`);
  console.log(`\n${MOVE_UP}`);
  process.exit(0);
}

// Listening needs no letters, so it needs no --stage.
if (opt.step === 'ear') {
  let items;
  try {
    items = earScript(opt.ear, { seed, count: Math.min(count, 8) });
  } catch (error) {
    fail(error.message);
  }
  const level = String(opt.ear).toUpperCase();
  if (opt.json) {
    console.log(JSON.stringify({ step: 'ear', level, items }, null, 2));
  } else {
    console.log(`Listening, level ${level}: ${EAR_LEVELS[level].name}. ${ABOUT.ear}\n`);
    items.forEach((item, i) => {
      console.log(`${String(i + 1).padStart(2)}. You say:  ${item.say.join('  ...  ').padEnd(22)} She says:  ${item.word}`);
    });
    console.log(`\n${MOVE_UP}`);
  }
  process.exit(0);
}

if (!opt.stage && !opt.letters) {
  console.log(HELP);
  process.exit(2);
}

let known;
try {
  known = opt.letters ? parseGraphemes(opt.letters) : graphemesUpTo(Number(opt.stage));
} catch (error) {
  fail(error.message);
}
const tricky = opt.tricky === undefined ? DEFAULT_TRICKY : opt.tricky.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);

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
const onProgress = (done, total) => {
  if (done === 1 || done % 20 === 0 || done === total) note(`\rChoosing the ones that make sense: ${done} of ${total} read`);
  if (done === total) note('\n\n');
};
const header = () => console.log(`Letter-sounds: ${[...known].join(' ')}   Sight words: ${tricky.join(' ') || '(none)'}`);
const NOTHING = 'Nothing can be made from these letter-sounds yet. Add another set, or a sight word with --tricky.';

// Single words need no model.
if (['two', 'words', 'chain'].includes(opt.step)) {
  const sounded = (w) => `${w.word.padEnd(6)} ${w.sounds.join(' - ')}`;
  let lines = [];
  if (opt.step === 'two') lines = twoSoundWords(known, { tricky }).map(sounded);
  if (opt.step === 'words') lines = threeSoundWords(known, { seed, count }).map(sounded);
  if (opt.step === 'chain') lines = chains(known, { seed, count: Math.min(count, 4) }).map((chain) => chain.join('  ->  '));
  if (opt.json) {
    console.log(JSON.stringify({ step: opt.step, letterSounds: [...known], lines }, null, 2));
  } else if (!lines.length) {
    console.log(NOTHING);
  } else {
    header();
    console.log(`${ABOUT[opt.step]}\n`);
    lines.forEach((line, i) => console.log(`${String(i + 1).padStart(2)}. ${line}`));
    console.log(`\n${MOVE_UP}`);
  }
  process.exit(lines.length || opt.json ? 0 : 1);
}

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
let sentences;
let considered = 0;
if (opt.step === 'story') {
  ({ sentences } = await story(known, { length: Math.min(count, 6), tricky, seed, surprise, onProgress }));
} else if (opt.step === 'phrases') {
  ({ sentences, considered } = await phrases(known, { count, tricky, seed, surprise, onProgress }));
} else {
  ({ sentences, considered } = await generate(known, { count, tricky, seed, focus, surprise, onProgress }));
}

if (opt.json) {
  console.log(JSON.stringify({
    step: opt.step, letterSounds: [...known], sightWords: tricky, rankedByModel: Boolean(surprise), considered,
    sentences: sentences.map((s) => ({ text: s.text, surprise: Number(s.score.toFixed(3)) })),
  }, null, 2));
} else if (!sentences.length) {
  console.log(NOTHING);
} else {
  header();
  if (opt.step === 'story') {
    console.log(`${ABOUT.story}`);
    console.log(surprise ? 'Each sentence was chosen by a local model to follow the one before.\n' : 'Not ranked: --no-model.\n');
    console.log(sentences.map((s) => s.text).join('\n'));
    console.log(`\n${MOVE_UP}`);
  } else {
    console.log(surprise ? `Ranked for sense by a local model, best first (${considered} considered):\n`
      : `Not ranked: --no-model (${considered} considered):\n`);
    sentences.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.text}`));
  }
}
process.exit(sentences.length || opt.json ? 0 : 1);
