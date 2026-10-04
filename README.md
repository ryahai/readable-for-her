# readable-for-her

Practice sentences a beginner reader can actually sound out.

You tell it which letter-sounds a child has been taught so far. It writes short sentences using only
those sounds, then a small open-weight language model running on your own computer puts the ones
that make sense at the top.

```
$ readable --stage 3 --count 8
Letter-sounds: s a t p i n m d g o c k   Sight words: the
Ranked for sense by a local model, best first (463 considered):

 1. The pot is in the pit.
 2. Pam sat on the mat.
 3. A man is mad.
 4. Dad can mop in a pan.
 5. Sid got a tan map.
 6. A cat is sad.
 7. A kid can sit.
 8. A cap is dim.
```

Every word above uses only the twelve sounds in the first three sets, plus the sight word "the".

## Why

Early readers learn letter-sounds a few at a time. A sentence is only useful practice if every word
in it can be sounded out with the sounds learned so far. Most "easy" sentences fail that test: "The
duck is in the pond" looks simple, but a child who knows `c` and `k` and has not met `ck` cannot read
"duck".

Writing sentences under that constraint by hand is slow, and the supply runs out fast.

## How it works

Two parts, each doing what it is good at:

1. **Rules guarantee she can read it.** A word counts as readable only if it splits, left to right,
   into letter-sounds she has been taught. Digraphs are strict: `duck` needs `ck`, `bell` needs `ll`.
   Sentences are assembled from a bank of about 150 regular words using a dozen sentence shapes.
   This step cannot produce an unreadable word, and the tests check that at every stage.
2. **A model picks the ones that make sense.** Rules can build "A mat can dig" as easily as "A pig
   can dig". [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct), an
   open-weight model (Apache-2.0), scores how surprising each sentence is, and the least surprising
   ones win. Sentences are compared within their own shape, because a language model otherwise
   favours whatever pattern is shortest.

The model never writes text. It only ranks. So nothing it does can put an unreadable word on the page.

## Install

Needs Node.js 20 or newer.

```
git clone <this repo>
cd readable-for-her
npm install
node src/cli.js --stage 3
```

The first run downloads the model (about 120 MB) from Hugging Face and caches it. After that, add
`--offline` and it never touches the network. It used about 400 MB of memory on an 8 GB laptop and
scored each sentence in roughly a tenth of a second.

## Use

```
readable --stage 3                 ten sentences using the first three letter-sets
readable --letters s,a,t,p,i,n     use exactly these letter-sounds instead
readable --stage 4 --focus ck      prefer sentences that practise "ck"
readable --check "The duck is in the pond" --stage 3
                                   show which words she cannot read yet
```

| Option | Meaning |
|---|---|
| `--count N` | How many sentences (default 10) |
| `--tricky a,b` | Sight words she knows (default: `the`) |
| `--seed N` | Repeat a run exactly (default 1); change it for a fresh page |
| `--no-model` | Skip the model: sentences are readable but not ranked for sense |
| `--offline` | Never contact the network |
| `--model ID` | Another open-weight causal language model from Hugging Face |
| `--json` | Machine-readable output |

Letter-sets follow the order most UK synthetic-phonics programmes use (Letters and Sounds, Phase 2
sets 1-5 and Phase 3 sets 6-7):

| Set | Letter-sounds |
|---|---|
| 1 | s a t p |
| 2 | i n m d |
| 3 | g o c k |
| 4 | ck e u r |
| 5 | h b f ff l ll ss |
| 6 | j v w x |
| 7 | y z zz qu |

If your programme teaches a different order, pass the exact sounds with `--letters`.

## Limits

- The model is tiny, so some sentences are silly ("A hen can mop"). They are still readable, which
  is the part that has to be right. Read the page before you hand it over.
- Set 1 alone (`s a t p`) cannot make a sentence with this word bank; the tool says so.
- English only, short-vowel words only. No long vowels, blends are limited to a few words.
- The word bank is small and hand-written. Adding words is one line in `src/words.js`.

## Tests

```
npm test
```

Sixteen tests. One of them generates sentences at all seven stages and checks every word of every
sentence against the phonics rules. One loads the real model and checks it prefers sense to nonsense;
set `READABLE_SKIP_MODEL=1` to skip that one.

## Built with

- [Transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0) to run the model locally
- [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) (Apache-2.0)

The code in this repository was written by an AI coding agent (Claude Code) working to its owner's
direction, during the DEV Hacktoberfest 2026 Weekend Challenge window.

## Licence

MIT
