// Scores how natural a sentence sounds, using a small open-weight language
// model that runs on this machine. Lower score = more natural.
//
// The score is the model's average surprise per token (negative log
// likelihood). "The cat sat on a mat" surprises it less than "The mat sat
// on a cat", which is exactly the judgement a rule cannot make.
import { AutoModelForCausalLM, AutoTokenizer, env } from '@huggingface/transformers';

export const DEFAULT_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';

export async function loadScorer(modelId = DEFAULT_MODEL, { offline = false } = {}) {
  if (offline) env.allowRemoteModels = false; // use only what is already on disk
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await AutoModelForCausalLM.from_pretrained(modelId, { dtype: 'q4' });
  const bos = tokenizer.bos_token ?? tokenizer.eos_token ?? '';

  return async function surprise(sentence) {
    // A leading token gives the model something to predict the first word from.
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
