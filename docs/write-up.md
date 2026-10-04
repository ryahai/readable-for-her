This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)

You can try it right now, with nothing to install: [ryahai.github.io/readable-for-her](https://ryahai.github.io/readable-for-her/)

## What I Built

My daughter is eight, and reading is hard for her.

She knows her letter sounds. The part that trips her up is pushing those sounds together into a word. And here is what nobody tells you: almost every "easy" sentence you hand a child like her is quietly unfair.

Take "The duck is in the pond." It looks like baby reading. But if she hasn't been taught that ck is one sound yet, she cannot read "duck". She can only guess. And every guess teaches her that reading is guessing.

If you have ever sat next to a child who is trying so hard and still can't get through the page, you know that feeling. I didn't want one more page that set her up to fail.

So I built her a little reading school where every single word is one she can actually sound out.

You tell it which sounds she has learned. It gives her words, sentences and tiny stories made only from those sounds. Nothing sneaks in. Then a small open AI model, running right there on your own device, picks the sentences that actually make sense, so she reads "The dog can dig" and not "The mat can dig".

![Today's plan: a feelings check-in, seven reading steps with a break in the middle, and a closing](https://raw.githubusercontent.com/ryahai/readable-for-her/main/docs/web-today.png)

## How a day goes

She already uses a learning app at home, so I made this one look and feel the same. Nothing new to figure out except the reading.

She picks a face. No name, no sign-up. Then the day goes like this:

1. How are you feeling? Any feeling is okay. If she picks a sad or worried face, she gets the calm corner first.
2. Listen and say the word. No letters at all. I say "m ... a ... p" and she says "map".
3. Build the word. I say the sounds, she taps the tiles.
4. Read the word.
5. Break time. Water, a snack, a stretch. No work.
6. Word chains. tin, pin, pit, sit. One sound changes each time.
7. Phrases, then sentences, then a story. Five sentences about one person. That is real reading.
8. What went well today?

![Building a word from sound tiles](https://raw.githubusercontent.com/ryahai/readable-for-her/main/docs/web-build.png)

Every word she reads earns a star and a coin. Ten stars and she levels up, with a new little friend and a new world to unlock. Coins buy rewards, and a grown-up has to say yes to each one. There is always a calm corner and a pause button within reach.

![Level up: a new friend and a new world](https://raw.githubusercontent.com/ryahai/readable-for-her/main/docs/web-level-up.png)

It also talks to her in a warm, human voice. More on that below, because I cared about it a lot.

One rule I kept for myself: the app never decides she has passed. She moves up when she gets four out of five without help, on two different days, and I decide. Not the software.

## Demo

[ryahai.github.io/readable-for-her](https://ryahai.github.io/readable-for-her/)

Pick a face and press Start. The listening, building and word steps open instantly. The first time you open sentences or a story, it downloads the small AI model (about 100 MB, once), and after that it is saved.

![A sentence chosen by the model](https://raw.githubusercontent.com/ryahai/readable-for-her/main/docs/web-sentence.png)

![Break time](https://raw.githubusercontent.com/ryahai/readable-for-her/main/docs/web-break.png)

There is also a box for grown-ups. Type any sentence from a real book and it shows you exactly which words she can't sound out yet.

## Code

{% embed https://github.com/ryahai/readable-for-her %}

## How I Built It

I knew what my daughter needed and I set the rules. An AI coding agent (Claude Code) wrote the code, the tests and this write-up, to my direction. I am telling you that plainly because it matters.

The idea is simple, and it has two halves.

### Rules decide what she can read

A word only gets in if it can be split into sounds she has been taught. No exceptions, and there are tests that check every word at every level.

### A small AI decides what makes sense

Rules alone will happily write "A mat can dig." They don't know a dog is the one that digs. So every possible sentence is shown to [SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct), a tiny open model, and it keeps the ones that sound like something a person would really say. "The cat sat on a mat" beat "The mat sat on a cat."

The AI never writes a single word. It only chooses. A tiny model that writes will break the spelling rules. A tiny model that only picks can't hurt anything.

### It all runs in your browser

No server, no account, nothing sent anywhere. It's a page for a child. It should not be watching her.

### The voice

The first version used the computer's built-in voice and it sounded like a robot. I hated it. A child who is already nervous about reading does not need a robot talking at her. So every line the app says was recorded once with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), an open voice model, and now everyone hears the same gentle voice in any browser.

The one thing the voice does not do is say the letter sounds. I do that. A child learns to blend from a real person saying the sounds, and a machine gets single sounds wrong.

### What went wrong along the way

The first page it made was the same sentence eight times with different words. The AI loved short, boring patterns. Now it has to mix them up.

It once offered her "sock" as s-o-c-k. That is the exact mistake this whole thing exists to stop. It is fixed, and there is a test with the word "sock" in it so it can never come back.

The first browser version froze the whole page while the AI was thinking. Now the AI works in the background and the page stays alive.

It runs on my 8 GB laptop, which is saying something.

## Why Does Open Innovation Matter?

Because this could not exist any other way.

It runs where she is. After the first load it needs no internet. A child's reading page should not depend on a connection, a login or a subscription.

It costs nothing. I can make her a fresh page every day without counting pennies.

Nothing is hidden. The words are in a file. The sentence patterns are in a file. If your child's school teaches the sounds in a different order, you can change it. If a better small model comes out, you can swap it in. Try doing that with a reading app you rent.

And honestly, a big closed model would have been the wrong tool even for free. I didn't need something clever. I needed something small, private and kind that could sit inside a web page on a child's device.

## Handing it over

I tested the finished command-line tool with her, using the story step. She tried it and it worked well.

That is what I built this for.

## Prize Categories

Overall prize only. This project does not use any partner technology.
