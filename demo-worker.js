// Runs the tool in the browser, off the page's main thread, so the page never freezes.
// The rules (which words she can sound out) are the same files the command-line tool uses.
// The model is the same open-weight model, SmolLM2-135M, running locally in this browser.
import { generate } from './src/generate.js';
import { ABOUT, EAR_LEVELS, MOVE_UP, chains, earScript, phrases, story, threeSoundWords, twoSoundWords } from './src/ladder.js';
import { DEFAULT_TRICKY, checkSentence, graphemesUpTo } from './src/phonics.js';

const MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';
const LIBRARY = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';
let scorer = null;

// Same scoring as src/scorer.js: the model's average surprise per token. Lower = more natural.
async function loadScorer(report) {
  const { AutoModelForCausalLM, AutoTokenizer } = await import(LIBRARY);
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.total) report(`Getting the model: ${Math.round((p.loaded / p.total) * 100)}%`);
  };
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL, { progress_callback });
  const model = await AutoModelForCausalLM.from_pretrained(MODEL, { dtype: 'q4', progress_callback });
  const bos = tokenizer.bos_token ?? tokenizer.eos_token ?? '';
  return async function surprise(sentence) {
    const inputs = await tokenizer(bos + sentence, { add_special_tokens: false });
    const { logits } = await model(inputs);
    const [, length, vocab] = logits.dims;
    const ids = inputs.input_ids.data;
    const data = logits.data;
    let total = 0;
    for (let t = 0; t < length - 1; t++) {
      const row = t * vocab;
      let max = -Infinity;
      for (let v = 0; v < vocab; v++) if (data[row + v] > max) max = data[row + v];
      let sum = 0;
      for (let v = 0; v < vocab; v++) sum += Math.exp(data[row + v] - max);
      total += max + Math.log(sum) - data[row + Number(ids[t + 1])];
    }
    return total / Math.max(1, length - 1);
  };
}

const sounds = (text, known) => checkSentence(text, known, DEFAULT_TRICKY)
  .map((w) => (w.tricky ? w.word : w.graphemes ? w.graphemes.join('-') : w.word)).join('   ');

async function run({ step, stage, level, seed, useModel, sentence }) {
  const say = (status) => postMessage({ type: 'status', status });
  const known = graphemesUpTo(Number(stage));
  const letters = [...known].join(' ');
  if (step === 'check') {
    return { step, letters, words: checkSentence(sentence, known, DEFAULT_TRICKY)
      .map((w) => ({ word: w.word, ok: w.ok, how: w.tricky ? 'sight word' : w.graphemes ? w.graphemes.join(' - ') : 'uses a sound she has not met' })) };
  }
  if (step === 'ear') {
    const items = earScript(level, { seed, count: 8 });
    return { step, letters, about: `${EAR_LEVELS[level].name}. ${ABOUT.ear}`, rule: MOVE_UP,
      items: items.slice(0, 5).map((item, i) => ({ say: item.say, word: item.word,
        options: [item.word, items[(i + 1) % items.length].word, items[(i + 3) % items.length].word] })) };
  }
  if (step === 'build' || step === 'words') {
    const pool = [...threeSoundWords(known, { seed, count: 8 }), ...twoSoundWords(known)];
    return { step, letters, about: step === 'build' ? 'Hear the sounds, then build the word from its tiles.' : ABOUT.words, rule: MOVE_UP,
      items: pool.slice(0, 5).map((w) => ({ word: w.word, sounds: w.sounds })) };
  }
  if (step === 'chain') {
    return { step, letters, about: ABOUT.chain, rule: MOVE_UP, items: chains(known, { seed, count: 3 }).map((c) => ({ chain: c })) };
  }

  let surprise = null;
  if (useModel) {
    if (!scorer) {
      say('Getting the open model ready in your browser (about 100 MB, the first time only)');
      scorer = await loadScorer(say);
    }
    surprise = scorer;
  }
  const onProgress = (done, total) => { if (done % 4 === 0 || done === total) say(`The model is reading: ${done} of ${total}`); };
  const ranked = Boolean(surprise);
  let list;
  if (step === 'story') {
    list = (await story(known, { length: 5, seed, surprise, onProgress, perStep: 8 })).sentences;
  } else if (step === 'phrases') {
    list = (await phrases(known, { count: 5, seed, surprise, onProgress, tries: 80 })).sentences;
  } else {
    list = (await generate(known, { count: 5, seed, surprise, onProgress, tries: 100 })).sentences;
  }
  return { step, letters, ranked, about: ABOUT[step] ?? '', rule: MOVE_UP,
    items: list.map((s) => ({ text: s.text, sounds: sounds(s.text, known) })) };
}

onmessage = async (event) => {
  try {
    postMessage({ type: 'result', ...(await run(event.data)) });
  } catch (error) {
    postMessage({ type: 'error', message: String(error.message || error).split('\n')[0] });
  }
};
