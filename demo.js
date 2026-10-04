// A small reading school in the browser, laid out like the home learning app this tool grew beside:
// say how you feel, follow today's plan, take the break, collect stars and coins, finish with what went well.
// The reading content is made by the same code as the command-line tool, in a worker (demo-worker.js).
import { STAGES, graphemesUpTo } from './src/phonics.js';
import { LINES } from './voice-lines.js';

const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const render = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
const waitClick = (sel) => new Promise((res) => {
  document.querySelectorAll(sel).forEach((b) => { b.onclick = () => res(b.dataset.v ?? ''); });
});

const FACES = ['🦁', '🐼', '🦊', '🐸', '🐵', '🐰'];
const LEVELS = ['Seedling', 'Sprout', 'Explorer', 'Pathfinder', 'Star Reader', 'Story Captain'];
const PER_LEVEL = 10;
const FRIENDS = [['turtle', '🐢', 'Tilly', 1], ['chick', '🐥', 'Pip', 2], ['fox', '🦊', 'Rusty', 3], ['dolphin', '🐬', 'Splash', 4], ['owl', '🦉', 'Hoot', 5], ['unicorn', '🦄', 'Comet', 6]]
  .map(([id, emoji, name, level]) => ({ id, emoji, name, level }));
const WORLDS = [['savannah', 'Savannah', 1], ['sea', 'Sea', 2], ['rainforest', 'Rainforest', 3], ['carnival', 'Carnival', 4], ['sunset', 'Sunset', 5], ['space', 'Space', 6]]
  .map(([id, name, level]) => ({ id, name, level }));
const REWARDS = [['📚', 'Choose tonight\'s story', 10], ['🎮', 'Ten minutes of a game', 20], ['🍪', 'Bake something together', 30], ['🏞️', 'Choose the weekend outing', 50]]
  .map(([emoji, title, cost], id) => ({ id, emoji, title, cost }));
const PLAN = [
  { id: 'checkin', kind: 'checkin', em: '🌤️', title: 'How are you feeling?', sub: 'Any feeling is okay.' },
  { id: 'ear', kind: 'read', em: '👂', title: 'Listen and say the word', sub: 'No letters. A grown-up says the parts, you say the whole word.' },
  { id: 'build', kind: 'read', em: '🧩', title: 'Build the word', sub: 'Hear the sounds, then tap the tiles in order.' },
  { id: 'words', kind: 'read', em: '🔤', title: 'Read the word', sub: 'Say each sound, then the whole word.' },
  { id: 'break', kind: 'break', em: '🧃', title: 'Break time', sub: 'Water, a snack, a stretch. No work now.', minutes: 3 },
  { id: 'chain', kind: 'read', em: '🔗', title: 'Word chains', sub: 'One sound changes each time. What changed?' },
  { id: 'phrases', kind: 'read', em: '🗣️', title: 'Phrases', sub: 'A few words that go together.', model: true },
  { id: 'sentences', kind: 'read', em: '📖', title: 'Sentences', sub: 'One sentence at a time, then tell what happened.', model: true },
  { id: 'story', kind: 'read', em: '📚', title: 'A story', sub: 'Five sentences about one person. Real reading.', model: true },
  { id: 'closing', kind: 'closing', em: '🌈', title: 'What went well today?', sub: 'Finish the day.' },
];

// ---------- what is remembered (on this device only) ----------
let S = { face: null, stars: 0, coins: 0, stage: 3, friend: 'turtle', world: 'savannah', voice: true, goal: null };
try { S = { ...S, ...JSON.parse(localStorage.getItem('readable-for-her') || '{}') }; } catch { /* storage may be blocked */ }
const keep = () => { try { localStorage.setItem('readable-for-her', JSON.stringify(S)); } catch { /* fine without it */ } };
const done = new Set();
let greeted = false;
const level = () => Math.min(LEVELS.length, Math.floor(S.stars / PER_LEVEL) + 1);
const friend = () => FRIENDS.find((f) => f.id === S.friend) ?? FRIENDS[0];

// ---------- voice ----------
// A recorded natural voice (see voice-lines.js), the same in every browser. A line that has no
// recording is simply not spoken: the page never falls back to a robotic browser voice.
const KEY = new Map(Object.entries(LINES).map(([key, text]) => [text, key]));
let playing = null;
function hush() { if (playing) { playing.pause(); playing = null; } }
function speak(text) {
  hush();
  const key = KEY.get(String(text).trim());
  if (!S.voice || !key) return;
  playing = new Audio(`./voice/${key}.mp3`);
  playing.play().catch(() => { /* the browser wants a tap first: stay quiet */ });
}

// ---------- the helper that makes the reading content ----------
let worker = null;
function ask(message, onStatus) {
  if (!worker) worker = new Worker('./demo-worker.js', { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'status') onStatus?.(data.status);
      else if (data.type === 'error') reject(new Error(data.message));
      else resolve(data);
    };
    worker.onerror = (e) => reject(new Error(e.message || 'the page could not start its helper'));
    worker.postMessage(message);
  });
}
function restartWorker() { if (worker) worker.terminate(); worker = null; }

// ---------- stars, coins, levels ----------
function overlay(html, cls = '') {
  const ov = document.createElement('div');
  ov.className = `overlay ${cls}`;
  ov.innerHTML = html;
  document.body.append(ov);
  return ov;
}
function confetti() {
  const colours = ['#f2b705', '#3f7cc4', '#3c9a6a', '#f2a65a', '#8a6cc7', '#e86a92'];
  return `<div class="confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${colours[i % 6]};
    animation-duration:${3 + (i % 5) * 0.6}s;animation-delay:${-(i % 7) * 0.5}s"></i>`).join('')}</div>`;
}
function celebrate(emoji, title, text, button = 'Keep going', line = '') {
  return new Promise((res) => {
    const ov = overlay(`${confetti()}<div class="celebrate-emoji">${emoji}</div><h1>${esc(title)}</h1>
      <p class="lesson-text">${esc(text)}</p><button class="big-btn green">${esc(button)}</button>`, 'celebrate');
    speak(line);
    ov.querySelector('button').onclick = () => { ov.remove(); hush(); res(); };
  });
}
async function reward() {
  const before = level();
  S.stars += 1; S.coins += 1; keep();
  const toast = document.createElement('div');
  toast.className = 'coin-toast'; toast.textContent = '+1 ⭐   +1 🪙';
  document.body.append(toast); setTimeout(() => toast.remove(), 1400);
  const burst = document.createElement('div');
  burst.className = 'burst';
  for (let i = 0; i < 10; i++) {
    const star = document.createElement('i');
    const angle = (Math.PI * 2 * i) / 10;
    star.textContent = i % 2 ? '⭐' : '✨';
    star.style.setProperty('--x', `${Math.cos(angle) * 170}px`);
    star.style.setProperty('--y', `${Math.sin(angle) * 150}px`);
    burst.append(star);
  }
  document.body.append(burst); setTimeout(() => burst.remove(), 950);
  if (level() > before) {
    await new Promise((r) => setTimeout(r, 900));
    const lv = level();
    const pal = FRIENDS.find((f) => f.level === lv);
    const world = WORLDS.find((w) => w.level === lv);
    await celebrate('🎉', `Level ${lv}: ${LEVELS[lv - 1]}!`,
      `You unlocked a new friend, ${pal.emoji} ${pal.name}, and a new world, ${world.name}. Find them in My collection.`, 'Keep going', LINES.levelup);
  }
}

// ---------- screens ----------
function pickFace() {
  $('#dock').hidden = true;
  render(`<div class="stage"><h1>📖 Readable for her</h1><p class="lesson-text">Who is reading today? Pick your face.</p>
    <div class="kids" style="width:100%;max-width:820px">${FACES.map((f) => `<button class="kid" data-v="${f}"><span class="face">${f}</span>That's me</button>`).join('')}</div>
    <p class="muted small" style="max-width:760px">No names, no sign-up. Stars and coins are kept only on this device.<br>
      Every word here is built from the letter-sounds she has been taught, and a small open model running in your browser chooses the sentences that make sense.</p></div>`);
  waitClick('.kid').then((face) => { S.face = face; keep(); today(); });
}

function heroHtml() {
  const lv = level();
  const inLevel = S.stars - (lv - 1) * PER_LEVEL;
  const top = lv >= LEVELS.length;
  const next = FRIENDS.find((f) => f.level === lv + 1);
  return `<div class="hero">
    <div class="avatar"><span class="face">${S.face}</span><span class="pet">${friend().emoji}</span></div>
    <div class="grow" style="min-width:240px">
      <h1 style="margin:0">Hello, reader!</h1>
      <div><span class="level-badge">⭐ Level ${lv}</span><b>${LEVELS[lv - 1]}</b></div>
      <div class="xp-bar"><span style="width:${top ? 100 : Math.min(100, (inLevel / PER_LEVEL) * 100)}%"></span></div>
      <div class="muted small">${top ? 'You reached the top level! Keep collecting stars.' : `${inLevel} of ${PER_LEVEL} stars to Level ${lv + 1}`}${
        next ? ` · next prize: ${next.emoji} ${next.name}` : ''} · ⭐ ${S.stars} stars</div>
    </div>
    <div class="hero-buttons">
      <button class="big-btn soft" id="collection">🎒 My collection</button>
      <button class="big-btn soft" id="shop">🎁 Rewards · 🪙 ${S.coins}</button>
      <button class="big-btn soft" id="switch">🙂 Change face</button>
    </div></div>`;
}

function today() {
  document.body.dataset.theme = S.world;
  $('#dock').hidden = false;
  const next = PLAN.find((b) => !done.has(b.id));
  render(`${heroHtml()}
    <div class="card" style="margin-top:16px">
      <b>Grown-up: which sounds has she been taught?</b>
      <div class="sets">${STAGES.map((_, i) => `<button data-v="${i + 1}" class="${S.stage === i + 1 ? 'on' : ''}">Set ${i + 1}</button>`).join('')}</div>
      <div>She knows: <span class="letters">${esc([...graphemesUpTo(S.stage)].join(' '))}</span> <span class="muted small">and the sight word “the”</span></div>
    </div>
    <h2>Today's plan</h2>
    <div class="blocks">${PLAN.map((b) => `<button class="block ${b === next ? 'next' : ''} ${done.has(b.id) ? 'done' : ''}" data-v="${b.id}">
        <span class="em">${b.em}</span><span><b>${esc(b.title)}${b.model ? '<span class="tag">chosen by the model</span>' : ''}</b><span class="muted">${esc(b.sub)}</span></span>
        ${done.has(b.id) ? '<span class="tick">✔</span>' : ''}</button>`).join('')}</div>
    <div class="center">${next ? `<button class="big-btn green" id="start">Start: ${esc(next.title)}</button>` : '<p class="lesson-text">All done for today. Well done!</p>'}</div>
    <div class="card" style="margin-top:26px">
      <h2 style="margin-top:0">🔎 Grown-ups: check a sentence</h2>
      <p class="muted small" style="margin:0">Type any sentence from a book. It shows the words she cannot sound out yet.</p>
      <div class="check-row"><input id="checkText" value="The duck is in the pond" aria-label="Sentence to check"><button class="big-btn soft" id="checkBtn">Check</button></div>
      <div class="words" id="checkOut"></div><p class="muted" id="checkSum" style="margin:.6em 0 0"></p>
    </div>
    <p class="muted small center" style="margin-top:22px">Sentences and stories are chosen for sense by
      <a href="https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct">SmolLM2-135M</a>, a small open-weight model running here in your browser.
      Nothing on this page is sent anywhere.<br>Same code as the command-line tool:
      <a href="https://github.com/ryahai/readable-for-her">github.com/ryahai/readable-for-her</a> (MIT).</p>`);
  document.querySelectorAll('.sets button').forEach((b) => { b.onclick = () => { S.stage = Number(b.dataset.v); keep(); today(); }; });
  document.querySelectorAll('.block').forEach((b) => { b.onclick = () => startBlock(PLAN.find((x) => x.id === b.dataset.v)); });
  if (next) $('#start').onclick = () => startBlock(next);
  $('#collection').onclick = () => collection();
  $('#shop').onclick = shop;
  $('#switch').onclick = () => { hush(); pickFace(); };
  $('#checkBtn').onclick = async () => {
    const data = await ask({ step: 'check', stage: S.stage, sentence: $('#checkText').value });
    $('#checkOut').innerHTML = data.words.map((w) => `<span class="word ${w.ok ? '' : 'no'}"><b>${esc(w.word)}</b><small>${esc(w.how)}</small></span>`).join('');
    const stuck = data.words.filter((w) => !w.ok).length;
    $('#checkSum').textContent = stuck ? `${stuck} word(s) she cannot sound out yet with set ${S.stage}.` : 'She can read every word.';
  };
  $('#checkText').onkeydown = (e) => { if (e.key === 'Enter') $('#checkBtn').click(); };
  if (!greeted) { greeted = true; speak(LINES.hello); }
}

async function startBlock(block) {
  if (block.kind === 'checkin') await checkin();
  else if (block.kind === 'break') await breakTime(block);
  else if (block.kind === 'closing') await closing();
  else if (!(await lesson(block))) return today();
  done.add(block.id);
  today();
}

// ---------- feelings, calm corner, pause, break, closing ----------
async function checkin() {
  const faces = [['😢', 'very sad'], ['😟', 'worried'], ['😐', 'okay'], ['🙂', 'good'], ['😄', 'great']];
  render(`<div class="stage"><h1>How are you feeling today?</h1>
    <div class="faces">${faces.map(([f, w], i) => `<button data-v="${i}" aria-label="${w}">${f}</button>`).join('')}</div>
    <p class="muted">Any feeling is okay.</p></div>`);
  speak('Hello. How are you feeling today? Any feeling is okay.');
  const v = Number(await waitClick('.faces button'));
  if (v <= 1) {
    render(`<div class="stage"><h1>Thank you for telling me.</h1><p class="lesson-text">Would you like a calm break first, or shall we start gently?</p>
      <div class="row"><button class="big-btn soft" data-v="calm">Calm break</button><button class="big-btn" data-v="go">Start gently</button></div></div>`);
    speak('Thank you for telling me. Would you like a calm break first, or shall we start gently?');
    if ((await waitClick('[data-v]')) === 'calm') await calmCorner();
  }
}
function calmCorner() {
  return new Promise((res) => {
    if (document.querySelector('.overlay')) return res();
    const ov = overlay(`<h1>Calm corner</h1><div class="breathe"></div>
      <p class="lesson-text">Breathe in as the circle grows.<br>Breathe out as it gets smaller.<br>Take all the time you need.</p>
      <button class="big-btn green">I'm ready</button>`);
    speak('This is the calm corner. Breathe in as the circle grows. Breathe out as it gets smaller. Take all the time you need.');
    ov.querySelector('button').onclick = () => { ov.remove(); hush(); res(); };
  });
}
function pauseOverlay() {
  if (document.querySelector('.overlay')) return;
  hush();
  const ov = overlay(`<div style="font-size:5rem">⏸</div><h1>Paused</h1>
    <p class="lesson-text">Take your time. Your stars are saved.</p>
    <button class="big-btn green" id="resumeBtn">▶ Keep going</button><button class="big-btn soft" id="stopBtn">🏠 Stop for now</button>`);
  speak('Paused. Take your time. Your stars are saved.');
  ov.querySelector('#resumeBtn').onclick = () => { ov.remove(); hush(); };
  ov.querySelector('#stopBtn').onclick = () => { ov.remove(); hush(); stopLesson(); today(); };
}
async function breakTime(block) {
  render(`<div class="stage"><div style="font-size:6rem">🧃</div><h1>Break time</h1>
    <p class="lesson-text">Have some water or a snack. Stretch, move or rest. No work now.</p>
    <p class="muted" id="left"></p><button class="big-btn green" data-v="back">I'm back</button></div>`);
  speak('Break time. Have some water or a snack. Stretch, move or rest. No work now.');
  const end = Date.now() + block.minutes * 60000;
  const tick = () => {
    const m = Math.max(0, Math.ceil((end - Date.now()) / 60000));
    if ($('#left')) $('#left').textContent = m ? `About ${m} minute${m > 1 ? 's' : ''} of break left` : 'Come back when you are ready';
  };
  tick();
  const timer = setInterval(tick, 1000);
  await waitClick('[data-v="back"]');
  clearInterval(timer);
}
async function closing() {
  const chips = ['I tried hard', 'I learned something new', 'I asked for help', 'I sounded out a hard word', 'I took a break when I needed one', 'I kept going'];
  render(`<div class="stage"><h1>What went well today?</h1>
    <div class="chips">${chips.map((c) => `<button class="chip">${esc(c)}</button>`).join('')}</div>
    <button class="big-btn green" data-v="finish">Finish</button></div>`);
  speak('What went well today? Pick as many as you like.');
  document.querySelectorAll('.chip').forEach((c) => { c.onclick = () => { c.classList.toggle('on'); speak(c.textContent); }; });
  await waitClick('[data-v="finish"]');
  await celebrate('🌈', 'You finished today!', `You have ${S.stars} stars and ${S.coins} coins. See you next time.`, 'Done', LINES.finished);
}

// ---------- the reading lessons ----------
async function lesson(block, useModel = Boolean(block.model)) {
  const message = { step: block.id, stage: S.stage, level: S.stage <= 1 ? 'A' : S.stage === 2 ? 'D' : 'E', seed: 1 + Math.floor(Math.random() * 900), useModel };
  let wait = null;
  let skipped = false;
  if (useModel) {
    wait = overlay(`<div class="spinner"></div><div class="prompt" id="loadText">Getting ready</div>
      <p class="muted" style="max-width:640px;margin:0">A small open model is choosing the sentences that make sense. It runs on this device, so the first time takes a little while.</p>
      <button class="big-btn soft">Skip the model: rules only</button>`);
    wait.querySelector('button').onclick = () => { skipped = true; restartWorker(); wait.remove(); };
  }
  let data;
  try {
    data = await Promise.race([
      ask(message, (status) => { if ($('#loadText')) $('#loadText').textContent = status; }),
      new Promise((_, reject) => { const t = setInterval(() => { if (skipped) { clearInterval(t); reject(new Error('skipped')); } }, 200); }),
    ]);
  } catch (error) {
    wait?.remove();
    if (useModel) { restartWorker(); return lesson(block, false); }   // no model here: carry on with the rules alone
    await message_('🛠️', 'That could not start', error.message);
    return false;
  }
  wait?.remove();
  if (!data.items.length) {
    await message_('🧱', 'Not enough sounds yet', 'Nothing can be made from these letter-sounds yet. Choose a later set.');
    return false;
  }
  const badge = block.model ? `<span class="badge ${data.ranked ? '' : 'plain'}">${data.ranked ? '✨ Chosen for sense by the open model, in your browser' : 'Rules only: not checked for sense'}</span>` : '';
  let got = 0;
  for (let at = 0; at < data.items.length; at++) {
    const dots = data.items.map((_, i) => `<span class="${i < at ? 'got' : i === at ? 'on' : ''}"></span>`).join('');
    render(`<div class="row"><div class="progress-dots">${dots}</div><span class="grow"></span>${badge}</div><div class="stage" id="stage"></div>`);
    const earned = await item(block, data, data.items[at], at);
    if (earned === null) return false;      // stopped from the pause screen or the home button
    if (earned) { got += 1; await reward(); await new Promise((r) => setTimeout(r, 850)); }
  }
  await celebrate(got >= 4 ? '🏆' : '🌟', `${got} of ${data.items.length} stars`,
    `${got >= 4 ? 'Brilliant reading!' : 'Good trying!'} Grown-up: ${data.rule}`, 'Back to today', got >= 4 ? LINES.great : LINES.trying);
  return true;
}
function message_(emoji, title, text) {
  return new Promise((res) => {
    const ov = overlay(`<div style="font-size:5rem">${emoji}</div><h1>${esc(title)}</h1><p class="lesson-text">${esc(text)}</p><button class="big-btn">OK</button>`);
    ov.querySelector('button').onclick = () => { ov.remove(); res(); };
  });
}

function item(block, data, it, at) {
  const stage = $('#stage');
  return new Promise((res) => {
    const readIt = (bigHtml, soundsText, tell, say) => {
      stage.innerHTML = `<div class="prompt">${esc(data.about)}</div><div class="read">${bigHtml}</div><div class="soundline" id="snd"></div>
        <div class="row" style="justify-content:center"><button class="big-btn green" id="yes">✔ I read it</button>
        <button class="big-btn soft" id="hint">Show the sounds</button><button class="big-btn soft" id="skip">Try another</button></div>
        <div class="feedback help">${tell ? esc(tell) : ''}</div>`;
      if (say) speak(say);
      $('#yes').onclick = () => { $('#yes').disabled = true; speak('Well done!'); res(true); };
      $('#hint').onclick = () => { $('#snd').textContent = soundsText; };
      $('#skip').onclick = () => res(false);
    };
    if (block.id === 'ear') {
      const options = [...new Set(it.options)].sort(() => Math.random() - 0.5);
      stage.innerHTML = `<div class="prompt">Grown-up, say the parts slowly with a gap. No letters to look at.</div>
        <div class="say">${it.say.map(esc).join(' &nbsp;…&nbsp; ')}</div><div class="prompt">What word is it?</div>
        <div class="options">${options.map((o) => `<button class="opt" data-w="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="feedback" id="fb"></div>`;
      speak('Listen to the parts. What word is it?');
      stage.querySelectorAll('.opt').forEach((b) => { b.onclick = () => {
        if (b.dataset.w === it.word) {
          b.classList.add('right'); $('#fb').className = 'feedback good'; $('#fb').textContent = `Yes! ${it.word}`; speak(LINES.yes);
          stage.querySelectorAll('.opt').forEach((x) => { x.onclick = null; }); res(true);
        } else { b.classList.add('wrong'); $('#fb').className = 'feedback help'; $('#fb').textContent = 'Listen again. Push the parts together.'; speak('Listen again. Push the parts together.'); }
      }; });
    } else if (block.id === 'build') {
      const extra = [...graphemesUpTo(S.stage)].filter((g) => !it.sounds.includes(g)).slice(at, at + 2);
      const tiles = [...it.sounds, ...extra].sort(() => Math.random() - 0.5);
      let built = [];
      stage.innerHTML = `<div class="prompt">Grown-up, say the sounds. She builds the word.</div>
        <div class="say">${it.sounds.map(esc).join(' &nbsp;…&nbsp; ')}</div><div class="answer-box" id="box">&nbsp;</div>
        <div class="tiles">${tiles.map((g) => `<button class="tile" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        <div class="row" style="justify-content:center"><button class="big-btn soft" id="clear">Start again</button><button class="big-btn soft" id="skip">Try another</button></div>
        <div class="feedback" id="fb"></div>`;
      speak('Build the word. Tap the sounds in order.');
      const redraw = () => { $('#box').textContent = built.join('') || ' '; };
      $('#clear').onclick = () => { built = []; stage.querySelectorAll('.tile').forEach((t) => t.classList.remove('used')); $('#fb').textContent = ''; redraw(); };
      $('#skip').onclick = () => res(false);
      stage.querySelectorAll('.tile').forEach((t) => { t.onclick = () => {
        built.push(t.dataset.g); t.classList.add('used'); redraw();
        if (built.length < it.sounds.length) return;
        if (built.join('') === it.word) {
          $('#box').classList.add('right'); $('#fb').className = 'feedback good'; $('#fb').textContent = `You built ${it.word}!`; speak(LINES.built);
          stage.querySelectorAll('.tile').forEach((x) => { x.onclick = null; }); res(true);
        } else { $('#fb').className = 'feedback help'; $('#fb').textContent = 'Not yet. Say each sound and try again.'; speak('Not yet. Say each sound and try again.'); setTimeout(() => $('#clear')?.click(), 900); }
      }; });
    } else if (block.id === 'words') {
      readIt(esc(it.word), it.sounds.join('  -  '), '', 'Say each sound, then the word.');
    } else if (block.id === 'chain') {
      let n = 0;
      const draw = () => {
        const word = it.chain[n], prev = it.chain[n - 1];
        const html = [...word].map((ch, i) => (prev && prev[i] !== ch ? `<span class="new">${esc(ch)}</span>` : esc(ch))).join('');
        stage.innerHTML = `<div class="prompt">${esc(data.about)}</div><div class="muted">${it.chain.slice(0, n).map(esc).join('  →  ') || '&nbsp;'}</div>
          <div class="read">${html}</div><div class="row" style="justify-content:center"><button class="big-btn green" id="yes">✔ I read it</button></div>
          <div class="feedback help">${n ? 'What changed?' : 'Read the first word.'}</div>`;
        speak(n ? 'What changed?' : 'Read the first word.');
        $('#yes').onclick = () => { n += 1; if (n >= it.chain.length) { $('#yes').disabled = true; speak('Well done!'); res(true); } else draw(); };
      };
      draw();
    } else {
      readIt(esc(it.text), it.sounds, block.id === 'story' ? `Sentence ${at + 1} of the story` : '', at === 0 ? 'Read it out loud.' : '');
    }
    stopLesson = () => res(null);
  });
}
let stopLesson = () => {};

// ---------- collection and rewards ----------
function collection(tab = 'friend') {
  const lv = level();
  const cards = (tab === 'friend' ? FRIENDS : WORLDS).map((u) => {
    const open = lv >= u.level;
    const using = (tab === 'friend' ? S.friend : S.world) === u.id;
    const look = tab === 'friend' ? `<div class="big">${u.emoji}</div>` : `<div class="theme-swatch" data-theme="${u.id}"></div>`;
    return `<div class="collect ${open ? '' : 'locked'}">${look}<b>${esc(u.name)}</b>${
      !open ? `<div class="muted">🔒 Level ${u.level}</div>` : using ? '<div class="using">✓ Using</div>' : `<button data-v="${u.id}">Use this</button>`}</div>`;
  }).join('');
  render(`<div class="row"><h1 class="grow">🎒 My collection</h1><button class="big-btn soft" id="back">Back</button></div>
    <p class="muted">⭐ Level ${lv} ${LEVELS[lv - 1]} · every 10 stars is a new level, with a new friend and a new world.</p>
    <div class="collection-tabs"><button class="${tab === 'friend' ? 'on' : ''}" data-tab="friend">🐾 Friends</button>
      <button class="${tab === 'world' ? 'on' : ''}" data-tab="world">🎨 Worlds</button></div>
    <div class="collection">${cards}</div>`);
  $('#back').onclick = today;
  document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => collection(b.dataset.tab); });
  document.querySelectorAll('.collect button').forEach((b) => { b.onclick = () => {
    if (tab === 'friend') S.friend = b.dataset.v; else { S.world = b.dataset.v; document.body.dataset.theme = S.world; }
    keep(); collection(tab);
  }; });
}
function shop() {
  const goal = REWARDS.find((r) => r.id === S.goal);
  render(`<div class="row"><h1 class="grow">🎁 Rewards</h1><button class="big-btn soft" id="back">Back</button></div>
    <div class="card"><b>🪙 ${S.coins} coins</b> <span class="muted">· one coin for every star. A grown-up agrees each reward.</span>
      ${goal ? `<p>Saving for ${goal.emoji} <b>${esc(goal.title)}</b>: ${Math.min(S.coins, goal.cost)} of ${goal.cost}</p>
      <div class="coin-bar"><span style="width:${Math.min(100, Math.round((100 * S.coins) / goal.cost))}%"></span></div>` : ''}</div>
    <div class="shop">${REWARDS.map((r) => `<div class="card shop-item"><div style="font-size:2.6rem">${r.emoji}</div><h3>${esc(r.title)}</h3><p><b>🪙 ${r.cost}</b></p>
      <div class="coin-bar"><span style="width:${Math.min(100, Math.round((100 * S.coins) / r.cost))}%"></span></div>
      ${S.coins >= r.cost ? `<button class="big-btn green" data-v="${r.id}">I'd like this</button>`
        : `<p class="muted">${r.cost - S.coins} more coins to go</p><button class="big-btn soft" data-save="${r.id}">Save for this</button>`}</div>`).join('')}</div>`);
  $('#back').onclick = today;
  document.querySelectorAll('[data-save]').forEach((b) => { b.onclick = () => { S.goal = Number(b.dataset.save); keep(); shop(); }; });
  document.querySelectorAll('.shop-item [data-v]').forEach((b) => { b.onclick = async () => {
    const r = REWARDS[Number(b.dataset.v)];
    const ov = overlay(`<div style="font-size:5rem">${r.emoji}</div><h1>${esc(r.title)}</h1>
      <p class="lesson-text">Show this to your grown-up.</p>
      <button class="big-btn green" data-v="yes">Grown-up: yes, spend 🪙 ${r.cost}</button><button class="big-btn soft" data-v="no">Not now</button>`);
    ov.querySelectorAll('button').forEach((x) => { x.onclick = () => {
      if (x.dataset.v === 'yes') { S.coins -= r.cost; if (S.goal === r.id) S.goal = null; keep(); }
      ov.remove(); shop();
    }; });
  }; });
}

// ---------- dock ----------
$('#homeBtn').onclick = () => { hush(); stopLesson(); if (S.face) today(); };
$('#calmBtn').onclick = () => calmCorner();
$('#pauseBtn').onclick = () => pauseOverlay();
const voiceBtn = $('#voiceBtn');
const showVoice = () => { voiceBtn.setAttribute('aria-pressed', String(S.voice)); voiceBtn.textContent = S.voice ? '🔊 Read aloud' : '🔇 Read aloud off'; };
voiceBtn.onclick = () => { S.voice = !S.voice; keep(); if (!S.voice) hush(); showVoice(); };
showVoice();

document.body.dataset.theme = S.world;
if (S.face) today(); else pickFace();
