/* Тук-Тук Пианино / Tap Tap Piano — безопасная музыкальная игрушка для малышей.
   Любое нажатие (мышь, палец, любая клавиша) = красивый звук. */
'use strict';

/* ============================ настройки ============================ */

const LS_KEY = 'tuktuk-piano-v1';
const DEFAULTS = {
  mode: 'notes',      // notes = отдельные ноты | guitar = гитарные аккорды
  stroke: 'alt',      // alt = бой вниз-вверх | down = бой вниз | pick = перебор
  voice: 'marimba',   // маримба по умолчанию: быстрый спад, честная
                      // физика удара и отклик без «хвоста»
  chords: 0,          // 0 = одна нота, 1 = аккорд
  harmony: 'soft',    // soft = пентатоника (без диссонанса) | chromatic = как на пианино
  key: 0,             // транспозиция в полутонах
  vol: 75,
  fx: 1,
  guard: 1,           // полный экран + блокировка клавиатуры + защита от закрытия
  lang: ''            // '' = язык браузера, иначе en | ru | es | de
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return Object.assign({}, DEFAULTS, raw);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function saveSettings() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
}

const S = loadSettings();
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(
  (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent
);

/* ============================ язык ============================ */

let LANG = 'en';

function t(key) {
  const dict = I18N[LANG] || I18N.en;
  return (key in dict) ? dict[key] : (I18N.en[key] || key);
}

function applyI18n() {
  LANG = (S.lang && I18N[S.lang]) ? S.lang : detectLang();
  document.documentElement.lang = LANG;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

/* ============================ музыка ============================ */

const PAD_COUNT = 15;

// soft: мажорная пентатоника — в наборе нет ни полутонов, ни тритонов,
// поэтому любые две ноты (подряд или вместе) звучат созвучно.
const SCALES = { soft: [0, 2, 4, 7, 9], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
// 57 = A3. Ниже 500 Гц слух младенца хуже на 10-20 дБ, а ноутбучные
// динамики срезают низ; 48 (C3) звучал мимо ребёнка.
// chromatic был 55 (G) при подписи кнопки «C» — теперь подпись честная.
const BASE_MIDI = { soft: 57, chromatic: 48 };

function midiAt(step) {
  const sc = SCALES[S.harmony], L = sc.length;
  const oct = Math.floor(step / L);
  return BASE_MIDI[S.harmony] + S.key + 12 * oct + sc[step - oct * L];
}

// Ноты для клавиши: одна или аккорд по ступеням лада (в soft-режиме
// стопка пентатонных ступеней всегда даёт мягкое созвучие).
function notesFor(step) {
  if (!S.chords) return [midiAt(step)];
  if (S.harmony === 'soft') return [midiAt(step), midiAt(step + 2), midiAt(step + 4)];
  const root = midiAt(step);
  return [root, root + 4, root + 7];
}

/* ============================ звук ============================ */

/* Нота однократная: сыграла и сама затухла. Никакого сустейна —
   зажатая клавиша не должна гудеть. */
const PRESETS = {
  piano: {
    partials: [[1, 1, 'triangle'], [2, 0.34, 'sine'], [3, 0.11, 'sine'], [4.02, 0.05, 'sine']],
    dur: [1.2, 0.7], attack: 0.004, filter: [6500, 700], click: 0.05
  },
  marimba: {
    partials: [[1, 1, 'sine'], [4, 0.22, 'sine'], [9.2, 0.05, 'sine']],
    dur: [1.1, 0.55], attack: 0.002, filter: [9000, 1400], click: 0.03
  },
  bells: {
    // партиал 8.9x убран: на верхних нотах он уходил за 7 кГц
    partials: [[1, 1, 'sine'], [2.76, 0.36, 'sine'], [5.4, 0.16, 'sine']],
    dur: [1.4, 0.9], attack: 0.003, filter: [9000, 2200], click: 0
  },
  flute: {
    partials: [[1, 1, 'triangle'], [2, 0.12, 'sine'], [3, 0.05, 'sine']],
    dur: [1.4, 1.0], attack: 0.055, filter: [3500, 1100], click: 0, vibrato: 5.2
  }
};

/* ============================ гитарные аккорды ============================

   Дворовый набор в открытых позициях, стандартный строй E2 A2 D3 G3 B3 E4.
   midi — реально звучащие струны (заглушенные не указаны), состав каждого
   аккорда проверен расчётом. Раскладка по рядам:
     низ      Am Dm E7 C  G   — тональность ля минор, первые три «блатных»
     середина Em Bm D  A  E   — гитарные тональности
     верх     A7 D7 G7 B7 F   — доминанты и F                                */
const CHORDS = [
  { name: 'Am', midi: [45, 52, 57, 60, 64] },
  { name: 'Dm', midi: [50, 57, 62, 65] },
  { name: 'E7', midi: [40, 47, 50, 56, 59, 64] },
  { name: 'C',  midi: [48, 52, 55, 60, 64] },
  { name: 'G',  midi: [43, 47, 50, 55, 59, 67] },
  { name: 'Em', midi: [40, 47, 52, 55, 59, 64] },
  { name: 'Bm', midi: [47, 54, 59, 62, 66] },
  { name: 'D',  midi: [50, 57, 62, 66] },
  { name: 'A',  midi: [45, 52, 57, 61, 64] },
  { name: 'E',  midi: [40, 47, 52, 56, 59, 64] },
  { name: 'A7', midi: [45, 52, 55, 61, 64] },
  { name: 'D7', midi: [50, 57, 60, 66] },
  { name: 'G7', midi: [43, 47, 50, 55, 59, 65] },
  { name: 'B7', midi: [47, 51, 57, 59, 66] },
  { name: 'F',  midi: [41, 48, 53, 57, 60, 65] }
];

const STRUM_GAP = 0.016;      // удар вниз: 16 мс между струнами (~80 мс на шесть)
const STRUM_GAP_UP = 0.010;   // вверх рука идёт быстрее
const UP_STRINGS = 4;         // снизу медиатор достаёт только верхние струны
const STROKE_RESET = 600;     // после такой паузы такт начинается заново, с удара вниз
const PICK_STEP = 0.19;       // перебор: 190 мс между нотами, шестёрка укладывается в ~1.1 с
const PICK_RESET = 2200;      // такт перебора длиннее, чем пауза для боя, иначе бас
                              // сбрасывался бы на каждом нажатии и не чередовался

const MAX_VOICES = 16;
const MAX_VOICES_GUITAR = 26; // шесть струн на аккорд, нужен запас

let ac = null, bus, master, limiter, verb, wet, dry, noiseBuf;
let voices = [];

function initAudio() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = new AC({ latencyHint: 'interactive' });

  bus = ac.createGain(); bus.gain.value = 0.9;

  limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  master = ac.createGain(); master.gain.value = S.vol / 100;

  verb = ac.createConvolver(); verb.buffer = makeImpulse(2.0, 2.6);
  wet = ac.createGain(); wet.gain.value = 0.26;
  dry = ac.createGain(); dry.gain.value = 1;

  bus.connect(dry); dry.connect(limiter);
  bus.connect(verb); verb.connect(wet); wet.connect(limiter);
  limiter.connect(master); master.connect(ac.destination);

  noiseBuf = makeNoise(0.4);
  warmPlucks();
}

function makeImpulse(dur, decay) {
  const sr = ac.sampleRate, len = Math.floor(sr * dur);
  const buf = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const x = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay) * (i < sr * 0.005 ? i / (sr * 0.005) : 1);
    }
  }
  return buf;
}

function makeNoise(dur) {
  const sr = ac.sampleRate, len = Math.floor(sr * dur);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function pruneVoices() {
  const now = ac.currentTime;
  voices = voices.filter(v => v.end > now);
  const limit = S.mode === 'guitar' ? MAX_VOICES_GUITAR : MAX_VOICES;
  while (voices.length >= limit) {
    const v = voices.shift();
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      v.stop(now + 0.1);
    } catch (e) {}
  }
}

function playNote(midi, vel, delay) {
  if (!ac) return;
  midi = Math.max(24, Math.min(100, midi));
  pruneVoices();

  const p = PRESETS[S.voice] || PRESETS.piano;
  // +5 мс: попадание точно в currentTime может лечь в середину кванта и щёлкнуть
  const t0 = ac.currentTime + 0.005 + (delay || 0);
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const k = Math.max(0, Math.min(1, (midi - 48) / 36));           // 0 = низ, 1 = верх
  const dur = p.dur[0] + (p.dur[1] - p.dur[0]) * k;

  const sum = p.partials.reduce((a, x) => a + x[1], 0);
  const peak = Math.max(0.02, 0.5 * vel / Math.sqrt(sum * 2));

  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 0.7;
  filt.frequency.setValueAtTime(Math.min(18000, p.filter[0] * (0.6 + 0.4 * vel)), t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(p.filter[1], f * 1.6), t0 + dur * 0.85);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + p.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(filt); filt.connect(bus);

  const nodes = [];
  let lfoGain = null;
  if (p.vibrato) {
    const lfo = ac.createOscillator(); lfo.frequency.value = p.vibrato;
    lfoGain = ac.createGain(); lfoGain.gain.value = 14;             // центы
    lfo.connect(lfoGain); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    nodes.push(lfo);
  }

  for (let i = 0; i < p.partials.length; i++) {
    const ratio = p.partials[i][0], amp = p.partials[i][1], type = p.partials[i][2];
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f * ratio;
    o.detune.value = 0;          // одно и то же нажатие должно звучать одинаково
    if (lfoGain) lfoGain.connect(o.detune);
    const og = ac.createGain(); og.gain.value = amp;
    o.connect(og); og.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.06);
    nodes.push(o);
  }

  if (p.click > 0) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = Math.min(9000, f * 3.2); bp.Q.value = 1.1;
    const cg = ac.createGain();
    cg.gain.setValueAtTime(p.click * vel, t0);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(bp); bp.connect(cg); cg.connect(bus);
    src.start(t0); src.stop(t0 + 0.08);
    nodes.push(src);
  }

  voices.push({
    gain: g,
    start: t0,
    end: t0 + dur,
    stop(at) { for (const n of nodes) { try { n.stop(at); } catch (e) {} } }
  });
}

/* Щипковая струна по алгоритму Карплуса-Стронга: короткий шумовой импульс
   гоняется по кольцевому буферу длиной в период, на каждом обороте
   усредняется с соседом (это и даёт затухание обертонов, как у настоящей
   струны) и теряет по амплитуде. Считаем оффлайн в AudioBuffer и кешируем:
   петля обратной связи на узлах Web Audio квантуется 128 сэмплами и выше
   ~375 Гц просто не строит. */
const pluckCache = new Map();

function pluckBuffer(midi) {
  const hit = pluckCache.get(midi);
  if (hit) return hit;

  const sr = ac.sampleRate;
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  // Период дробный: округление до целых сэмплов расстраивало верхние струны
  // (на E4 это уже слышимые полтона-в-десятых). Читаем линию задержки с
  // линейной интерполяцией — строй точный на любой ноте.
  const P = sr / f;
  const M = Math.max(4, Math.ceil(P) + 2);
  const dur = Math.max(1.1, Math.min(2.8, 2.9 - (midi - 40) * 0.022));  // верх глохнет быстрее
  const len = Math.floor(sr * dur);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);

  // возбуждение: шум, сглаженный лоупассом — медиатор, а не щелчок
  const line = new Float32Array(M);
  let lp = 0;
  for (let i = 0; i < M; i++) {
    lp += ((Math.random() * 2 - 1) - lp) * 0.42;
    line[i] = lp;
  }
  // убираем постоянную составляющую, иначе струна «дышит»
  let mean = 0;
  for (let i = 0; i < M; i++) mean += line[i];
  mean /= M;
  for (let i = 0; i < M; i++) line[i] -= mean;

  // потеря за один оборот: -60 дБ ровно за dur секунд
  const loss = Math.pow(10, -3 * P / (sr * dur));
  let w = 0, prev = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    // -0.5: усредняющий фильтр в петле сам даёт полсэмпла задержки,
    // без этой поправки строй уезжает вниз тем сильнее, чем выше нота
    let rp = w - (P - 0.5);
    while (rp < 0) rp += M;
    const i0 = rp | 0;
    const fr = rp - i0;
    const cur = line[i0] * (1 - fr) + line[(i0 + 1) % M] * fr;
    line[w] = (cur + prev) * 0.5 * loss;
    prev = cur;
    w = w + 1 === M ? 0 : w + 1;
    d[i] = cur;
    const a = cur < 0 ? -cur : cur;
    if (a > peak) peak = a;
  }

  const norm = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.min(len, Math.floor(sr * 0.06));
  for (let i = 0; i < len; i++) {
    let v = d[i] * norm;
    if (i > len - fade) v *= (len - i) / fade;
    d[i] = v;
  }

  pluckCache.set(midi, buf);
  return buf;
}

function playPluck(midi, vel, delay, bright) {
  if (!ac) return;
  pruneVoices();
  const t0 = ac.currentTime + 0.005 + (delay || 0);
  const buf = pluckBuffer(midi);
  const src = ac.createBufferSource();
  src.buffer = buf;

  // корпус гитары: мягкий срез верха, иначе щипок звенит жестью
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  // вверх медиатор задевает струны ребром — звук ярче
  tone.frequency.value = bright ? 5200 : 3800;
  tone.Q.value = 0.6;

  const g = ac.createGain();
  g.gain.value = 0.42 * vel;

  src.connect(tone); tone.connect(g); g.connect(bus);
  src.start(t0);

  const voice = {
    gain: g,
    start: t0,
    end: t0 + buf.duration,
    stop(at) { try { src.stop(at); } catch (e) {} }
  };
  voices.push(voice);
  return voice;
}

/* Прогрев: 22 уникальные струны на все 15 аккордов считаются 28.7 мс.
   Раскладываем по кадрам простоя, чтобы первый бой не стоил 4 мс в кадре. */
let warmQueue = null;
function warmPlucks() {
  if (!ac || S.mode !== 'guitar' || warmQueue) return;
  const seen = new Set();
  warmQueue = [];
  for (const ch of CHORDS) for (const m of ch.midi) if (!seen.has(m)) { seen.add(m); warmQueue.push(m); }
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 16));
  const step = () => {
    if (!warmQueue || !warmQueue.length) { warmQueue = null; return; }
    pluckBuffer(warmQueue.shift());
    idle(step);
  };
  idle(step);
}

/* Перебор «шестёрка»: бас, 3, 2, 1, 2, 3 — самый ходовой дворовый рисунок.
   Одно нажатие играет один такт. Бас чередуется между двумя нижними
   струнами аккорда, как и положено, а смена аккорда глушит предыдущий
   перебор: не зазвучавшие ноты снимаются, уже звучащие затухают за 120 мс —
   так же гасит струны рука, переставляя аппликатуру. */
let pickVoices = [];
let pickBassAlt = false, lastPickAt = 0;

function stopPick() {
  if (!ac) { pickVoices = []; return; }
  const now = ac.currentTime;
  for (const v of pickVoices) {
    try {
      if (v.start > now) { v.stop(now); v.end = now; }          // ещё не зазвучала
      else {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        v.stop(now + 0.16);
        v.end = now + 0.12;
      }
    } catch (e) {}
  }
  pickVoices = [];
}

function pickChord(step, vel) {
  stopPick();
  const midi = CHORDS[step % CHORDS.length].midi;
  const n = midi.length;
  const now = performance.now();
  if (now - lastPickAt > PICK_RESET) pickBassAlt = false;
  lastPickAt = now;

  const bass = (pickBassAlt && n >= 5) ? midi[1] : midi[0];
  const seq = [bass, midi[n - 3], midi[n - 2], midi[n - 1], midi[n - 2], midi[n - 3]];
  const accent = [1, 0.72, 0.7, 0.82, 0.66, 0.68];   // бас ведёт, верх подсвечен
  for (let i = 0; i < seq.length; i++) {
    const v = playPluck(seq[i], vel * accent[i], i * PICK_STEP, i > 0);
    if (v) pickVoices.push(v);
  }
  pickBassAlt = !pickBassAlt;
}

/* Переменный штрих: удары чередуются вниз-вверх, как при живой игре.
   Вниз — все струны от басовой, 22 мс между ними. Вверх — только верхние
   четыре, в обратном порядке, быстрее, тише и ярче. После паузы в 600 мс
   счёт начинается заново, с удара вниз: так берут сильную долю. */
let lastStrumAt = 0, strokeDown = true;

function strumChord(step, vel) {
  if (S.stroke === 'pick') { pickChord(step, vel); return; }
  const midi = CHORDS[step % CHORDS.length].midi;
  const now = performance.now();
  if (S.stroke !== 'alt' || now - lastStrumAt > STROKE_RESET) strokeDown = true;
  lastStrumAt = now;

  if (strokeDown) {
    for (let i = 0; i < midi.length; i++) {
      playPluck(midi[i], vel * (1 - i * 0.04), i * STRUM_GAP, false);
    }
  } else {
    const first = Math.max(0, midi.length - UP_STRINGS);
    for (let k = 0; midi.length - 1 - k >= first; k++) {
      playPluck(midi[midi.length - 1 - k], vel * 0.82 * (1 - k * 0.04), k * STRUM_GAP_UP, true);
    }
  }

  if (S.stroke === 'alt') strokeDown = !strokeDown;
}

function playStep(step, vel) {
  if (S.mode === 'guitar') { strumChord(step, vel); return; }
  const notes = notesFor(step);
  for (let i = 0; i < notes.length; i++) {
    playNote(notes[i], vel * (i === 0 ? 1 : 0.62 - i * 0.06), i * 0.014);
  }
}

/* ============================ клавиши на экране ============================ */

/* Палитра построена в OKLCH при почти постоянной воспринимаемой светлоте
   и проверена численно: разброс L* 9.1 (было 43.9), dE между соседями
   12.6..34 (было 6.5..50, часть плиток была неразличима), контраст тёмной
   иконки 3.3:1 в покое и 5.0:1 при нажатии (белая давала 1.07:1).
   sparkL — светлота ядра искры, подобранная под ΔY = 0.20 для этой плитки
   (лимит 0.26; прежнее фиксированное 95% давало 0.53..0.67, то есть
   фактически белую вспышку). */
const PALETTE = [
  { a: '#fb9dae', b: '#f46178', h: 349, sparkL: 85 },
  { a: '#fcaa9c', b: '#fd676c', h: 9,   sparkL: 84 },
  { a: '#fcb489', b: '#fd773a', h: 22,  sparkL: 82 },
  { a: '#fcbd64', b: '#ea8f16', h: 35,  sparkL: 76 },
  { a: '#e8cc36', b: '#cea317', h: 51,  sparkL: 50 },
  { a: '#b6dc5d', b: '#a6b317', h: 78,  sparkL: 47 },
  { a: '#71e58f', b: '#50c23d', h: 136, sparkL: 49 },
  { a: '#32e3b9', b: '#1abe87', h: 166, sparkL: 48 },
  { a: '#30dbd6', b: '#19b3bc', h: 178, sparkL: 46 },
  { a: '#2fd3ee', b: '#18acd0', h: 189, sparkL: 63 },
  { a: '#6dc4fb', b: '#159dfb', h: 203, sparkL: 77 },
  { a: '#94b9fb', b: '#718cfc', h: 218, sparkL: 83 },
  { a: '#b3affb', b: '#a17afc', h: 243, sparkL: 88 },
  { a: '#d3a5fb', b: '#ca6ae9', h: 272, sparkL: 86 },
  { a: '#f998f1', b: '#e962c6', h: 305, sparkL: 84 }
];

/* Пять фигур на пять ступеней пентатоники: в каждом ряду один и тот же
   набор, а размер кодирует октаву — низкие ноты крупнее. Раньше было
   10 фигур на 15 плиток, из-за чего пять пар различались только цветом. */
const SHAPES = [
  '<circle cx="50" cy="50" r="32"/>',
  '<path d="M50 12l11 25 27 2-21 18 7 27-24-14-24 14 7-27-21-18 27-2z"/>',
  '<path d="M50 85C22 65 12 49 12 38c0-12 9-21 20-21 8 0 14 4 18 10 4-6 10-10 18-10 11 0 20 9 20 21 0 11-10 27-38 47z"/>',
  '<path d="M50 14l36 68H14z"/>',
  '<path d="M50 10l40 40-40 40-40-40z"/>'
];
const OCTAVE_INSET = ['15%', '19%', '23%'];   // низкая октава -> фигура крупнее

const padsEl = document.getElementById('pads');
const GRID = { cols: 5, rows: 3 };
let pads = [];        // {el, ripple, shape, step, hue, rect, anim}
let KEYMAP = new Map();

function computeGrid() {
  const landscape = window.innerWidth >= window.innerHeight;
  GRID.cols = landscape ? 5 : 3;
  GRID.rows = landscape ? 3 : 5;
  document.documentElement.style.setProperty('--cols', GRID.cols);
  document.documentElement.style.setProperty('--rows', GRID.rows);
}

function buildPads(animate) {
  computeGrid();
  padsEl.innerHTML = '';
  pads = [];
  for (let idx = 0; idx < PAD_COUNT; idx++) {
    const row = Math.floor(idx / GRID.cols), col = idx % GRID.cols;
    const step = (GRID.rows - 1 - row) * GRID.cols + col;   // низ-слева = самая низкая нота
    const c = PALETTE[step];
    const octave = Math.min(2, Math.floor(step / 5));

    const el = document.createElement('div');
    el.className = 'pad';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--pa', c.a);
    el.style.setProperty('--pb', c.b);
    el.style.setProperty('--h', c.h);
    el.style.setProperty('--inset', OCTAVE_INSET[octave]);
    el.style.setProperty('--diag', row + col);             // диагональная волна появления
    const face = S.mode === 'guitar'
      ? '<b class="label">' + CHORDS[step % CHORDS.length].name + '</b>'
      : '<b class="shape"><svg viewBox="0 0 100 100">' + SHAPES[step % SHAPES.length] + '</svg></b>';
    el.innerHTML = '<b class="lit"></b><b class="ripple"></b>' + face;
    padsEl.appendChild(el);

    pads.push({
      el, step, hue: c.h, sparkL: c.sparkL, rect: null,
      lit: el.querySelector('.lit'),
      ripple: el.querySelector('.ripple'),
      shape: el.querySelector('.shape') || el.querySelector('.label'),
      rippleAnim: null, shapeAnim: null,
      lastFx: -1e9
    });
  }
  padsEl.classList.toggle('enter', !!animate);
  // с fill:both анимации появления висят вечно — снимаем класс, когда отыграли
  if (animate) setTimeout(() => padsEl.classList.remove('enter'), 560);
  measurePads();
  buildKeyMap();
}

function measurePads() {
  const base = padsEl.getBoundingClientRect();
  for (const p of pads) {
    const el = p.el;
    const left = base.left + el.offsetLeft;
    const top = base.top + el.offsetTop;
    p.rect = {
      left: left, top: top,
      width: el.offsetWidth, height: el.offsetHeight,
      right: left + el.offsetWidth, bottom: top + el.offsetHeight
    };
  }
}

/* Раскладка клавиатуры -> сетка клавиш: верхний ряд клавиатуры к верхнему ряду
   клавиш, слева направо. Модификаторы тоже звучат — ребёнок жмёт и их. */
const KEY_ROWS = [
  ['Escape', 'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'MetaRight', 'ContextMenu', 'ControlRight']
];

function buildKeyMap() {
  KEYMAP = new Map();
  const R = GRID.rows, C = GRID.cols, P = KEY_ROWS.length;
  KEY_ROWS.forEach((row, ri) => {
    const padRow = Math.min(R - 1, Math.floor(ri * R / P));
    row.forEach((code, ci) => {
      const col = Math.min(C - 1, Math.floor(ci * C / row.length));
      KEYMAP.set(code, padRow * C + col);
    });
  });
}

function padForKey(e) {
  const code = e.code || e.key || '';
  if (KEYMAP.has(code)) return KEYMAP.get(code);
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return Math.abs(h) % PAD_COUNT;
}

/* ============================ анимация клавиш ============================ */

/* Контр-движение: плитка уходит вниз (scale .94), фигурка наоборот
   подрастает — именно этот контраст читается как «вдавили», а не «уменьшили».
   Плитка и подсветка живут на CSS-переходах, здесь только волна и фигурка. */
function padPressAnim(pad, fx, fy, quick) {
  if (REDUCED || !pad.el.animate) return;

  if (pad.rippleAnim) { try { pad.rippleAnim.cancel(); } catch (e) {} }
  pad.ripple.style.left = (fx * 100).toFixed(1) + '%';
  pad.ripple.style.top = (fy * 100).toFixed(1) + '%';
  pad.rippleAnim = pad.ripple.animate(
    [{ transform: 'translate(-50%,-50%) scale(.28)', opacity: .62 },
     { transform: 'translate(-50%,-50%) scale(2.9)', opacity: 0 }],
    { duration: 560, easing: 'cubic-bezier(.11,.72,.22,1)' }
  );

  if (pad.shapeAnim) { try { pad.shapeAnim.cancel(); } catch (e) {} }
  const peak = quick ? 1.06 : 1.10;
  pad.shapeAnim = pad.shape.animate(
    [{ transform: 'scale(1) rotate(0deg)' },
     { transform: 'scale(' + peak + ') rotate(' + (fx > .5 ? 5 : -5) + 'deg)', offset: .28 },
     { transform: 'scale(1) rotate(0deg)' }],
    { duration: 480, delay: 30, easing: 'cubic-bezier(.2,1.3,.32,1)' }
  );
}

/* Повторное нажатие раньше 340 мс: не новая вспышка, а провал яркости.
   Так частота изменения яркости одной плитки не выходит за 3 Гц. */
function padDip(pad) {
  if (REDUCED || !pad.lit.animate) return;
  pad.lit.animate([{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }],
                  { duration: 130, easing: 'ease-in-out' });
}

/* ============================ частицы ============================ */

const fxCanvas = document.getElementById('fx');
const g2 = fxCanvas.getContext('2d');

let bits = [];
let running = false, lastT = 0, dpr = 1;
let dirty = null;                 // область прошлого кадра — чистим только её
const spriteCache = new Map();

/* Авто-качество: если кадры тяжелеют — искр меньше, вплоть до нуля.
   Отклик клавиш при этом не страдает: он на CSS-переходах. */
let frameAvg = 16.7, quality = 1, qCheck = 0;

function gradeFrame(ms) {
  frameAvg += (Math.min(80, ms) - frameAvg) * 0.1;
  if (++qCheck < 24) return;
  qCheck = 0;
  if (frameAvg > 21 && quality > 0) quality = quality > 0.5 ? 0.5 : 0;
  else if (frameAvg < 13 && quality < 1) quality = quality < 0.5 ? 0.5 : 1;
}

function resizeCanvas() {
  // Ограничиваем только сверхсэмплинг; ниже 1 не опускаемся — иначе мыло.
  const MAX_PX = 4000000;
  dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const area = innerWidth * innerHeight * dpr * dpr;
  if (area > MAX_PX) dpr = Math.max(1, dpr * Math.sqrt(MAX_PX / area));
  fxCanvas.width = Math.max(1, Math.floor(innerWidth * dpr));
  fxCanvas.height = Math.max(1, Math.floor(innerHeight * dpr));
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  dirty = null;
}

/* Спрайт искры. Светлота ядра берётся из палитры и подобрана так, чтобы
   прирост яркости к своей плитке был ровно 0.20 (лимит 0.26). */
function glowSprite(hue, lightness) {
  const key = hue + ':' + lightness;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'hsla(' + hue + ',100%,' + lightness + '%,1)');
  gr.addColorStop(.36, 'hsla(' + hue + ',100%,' + lightness + '%,.9)');
  gr.addColorStop(.62, 'hsla(' + hue + ',95%,' + Math.max(30, lightness - 8) + '%,.35)');
  gr.addColorStop(1, 'hsla(' + hue + ',90%,' + Math.max(26, lightness - 12) + '%,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  spriteCache.set(key, c);
  return c;
}

/* Не салют, а подъём: звук, уходящий от клавиши. Искры летят вверх узким
   веером от точки касания, тормозят и растворяются рядом с клавишей.
   Скорость подъёма зависит от ступени — высокая нота летит выше. */
function burst(pad, fx, fy) {
  if (!S.fx || quality === 0 || bits.length > 90) return;
  const r = pad.rect;
  if (!r) return;                              // без синхронного layout в пути нажатия
  const size = Math.min(r.width, r.height);
  const x0 = r.left + r.width * (fx === undefined ? .5 : fx);
  const y0 = r.top + r.height * (fy === undefined ? .5 : fy);
  const lift = 1 + (pad.step / (PAD_COUNT - 1)) * 0.6;

  const n = quality < 1 ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 1.4;     // вверх, веер +-40 градусов
    const sp = size * (0.026 + Math.random() * 0.014) * lift;
    bits.push({
      x: x0, y: y0,
      vx: Math.cos(a) * sp + (fx - .5) * size * 0.004,
      vy: Math.sin(a) * sp,
      r: size * (0.045 + Math.random() * 0.03),
      hue: pad.hue + (Math.random() * 14 - 7),
      lum: pad.sparkL,
      life: 1,
      fade: 0.026
    });
  }
  if (!running) { running = true; lastT = 0; requestAnimationFrame(tick); }
}

function tick(now) {
  const ms = lastT ? now - lastT : 16.7;
  const dt = Math.min(2.6, ms / 16.667);
  lastT = now;
  gradeFrame(ms);

  if (dirty) {
    g2.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
    dirty = null;
  }
  let nx0 = 1e9, ny0 = 1e9, nx1 = -1e9, ny1 = -1e9;

  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.life -= b.fade * dt;
    if (b.life <= 0) { bits.splice(i, 1); continue; }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const drag = Math.pow(0.90, dt);
    b.vx *= drag;
    b.vy = b.vy * drag - 0.04 * dt;            // плавучесть вместо гравитации

    const s = b.r * (0.5 + b.life * 0.7);
    if (b.x - s < nx0) nx0 = b.x - s;
    if (b.y - s < ny0) ny0 = b.y - s;
    if (b.x + s > nx1) nx1 = b.x + s;
    if (b.y + s > ny1) ny1 = b.y + s;

    // alpha ~ life^1.6: без плоской яркой полки в начале жизни
    g2.globalAlpha = 0.85 * Math.pow(b.life, 1.3);
    g2.drawImage(glowSprite(Math.round(b.hue), b.lum), b.x - s, b.y - s, s * 2, s * 2);
    g2.globalAlpha = 1;
  }

  if (nx1 > nx0) {
    dirty = [Math.max(0, nx0 - 2), Math.max(0, ny0 - 2),
             Math.min(innerWidth, nx1 + 2), Math.min(innerHeight, ny1 + 2)];
  }

  if (bits.length) requestAnimationFrame(tick);
  else { running = false; lastT = 0; clearFx(); }
}

function clearFx() {
  bits = [];
  dirty = null;
  g2.clearRect(0, 0, innerWidth, innerHeight);
}

/* ============================ ввод ============================ */

const heldKeys = new Map();      // code -> padIndex
const keyTimers = new Map();     // code -> таймер аварийного отпускания
const heldPointers = new Map();  // pointerId -> padIndex
let started = false;

let fxWindow = 0, fxCount = 0;
let onsetWindow = 0, onsetCount = 0;

// Ребёнок бьёт ладонью: десять одновременных волн и облаков GPU не переварит,
// а на глаз они всё равно не различимы.
function richFxAllowed() {
  const now = performance.now();
  if (now - fxWindow > 120) { fxWindow = now; fxCount = 0; }
  return ++fxCount <= 4;
}

// Ладонь — одно действие. Восемь нот сразу дают кашу, поэтому в окне 40 мс
// звучат максимум три (в пентатонике это аккорд, а не мешанина).
function onsetAllowed() {
  const now = performance.now();
  // Бой — одно движение руки: два аккорда в 90 мс дают кашу из 12 струн.
  const win = S.mode === 'guitar' ? 90 : 40;
  const max = S.mode === 'guitar' ? 1 : 3;
  if (now - onsetWindow > win) { onsetWindow = now; onsetCount = 0; }
  return ++onsetCount <= max;
}

function press(idx, vel, fx, fy) {
  const pad = pads[idx];
  if (!pad) return;
  const px = fx === undefined ? .5 : fx;
  const py = fy === undefined ? .5 : fy;
  const now = performance.now();
  const fresh = now - pad.lastFx > 340;        // не чаще 3 Гц на одну плитку

  pad.el.classList.add('on');

  if (fresh && richFxAllowed()) {
    pad.lastFx = now;
    padPressAnim(pad, px, py, false);
    burst(pad, px, py);
  } else if (!fresh) {
    padDip(pad);
  }

  if (onsetAllowed()) playStep(pad.step, vel);
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
}

function release(idx) {
  const pad = pads[idx];
  if (!pad) return;
  let stillHeld = false;
  for (const v of heldKeys.values()) if (v === idx) stillHeld = true;
  for (const v of heldPointers.values()) if (v === idx) stillHeld = true;
  if (stillHeld) return;
  pad.el.classList.remove('on');   // пружинный возврат делает transition в CSS
}

function releaseAll() {
  for (const timer of keyTimers.values()) clearTimeout(timer);
  keyTimers.clear();
  heldKeys.clear();
  heldPointers.clear();
  for (const p of pads) {
    p.el.classList.remove('on');
  }
}

function uiOpen() {
  return !startEl.hidden || !settingsEl.hidden || !resumeEl.hidden;
}

/* --- клавиатура --- */
function onKeyDown(e) {
  if (uiOpen()) {
    if (e.key === 'Escape' && !settingsEl.hidden) { e.preventDefault(); closeSettings(); }
    return;
  }
  // Гасим всё, что браузер разрешает погасить: F5, Ctrl+P, Ctrl+S, Tab, / и т.п.
  e.preventDefault();
  if (e.repeat) return;
  const code = e.code || e.key;
  if (heldKeys.has(code)) return;
  const idx = padForKey(e);
  heldKeys.set(code, idx);
  // На маке при удержании Cmd браузер не присылает keyup — иначе клавиша
  // осталась бы подсвеченной навсегда.
  clearTimeout(keyTimers.get(code));
  keyTimers.set(code, setTimeout(() => {
    keyTimers.delete(code);
    if (heldKeys.has(code)) { heldKeys.delete(code); release(idx); }
  }, 2500));
  // фиксированные скорость и точка: ребёнок проверяет, что одно и то же
  // действие даёт один и тот же результат
  press(idx, 1, .5, .5);
}

function onKeyUp(e) {
  if (uiOpen()) return;
  e.preventDefault();
  const code = e.code || e.key;
  clearTimeout(keyTimers.get(code));
  keyTimers.delete(code);
  if (!heldKeys.has(code)) return;
  const idx = heldKeys.get(code);
  heldKeys.delete(code);
  release(idx);
}

/* --- мышь / тач --- */
function padIndexAt(x, y) {
  for (let i = 0; i < pads.length; i++) {
    const r = pads[i].rect;
    if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

function fracIn(idx, x, y) {
  const r = pads[idx].rect;
  return r ? [(x - r.left) / r.width, (y - r.top) / r.height] : [.5, .5];
}

padsEl.addEventListener('pointerdown', e => {
  e.preventDefault();
  const idx = padIndexAt(e.clientX, e.clientY);
  if (idx < 0) return;
  heldPointers.set(e.pointerId, idx);
  const f = fracIn(idx, e.clientX, e.clientY);
  press(idx, 0.7 + (e.pressure ? e.pressure * 0.3 : 0.3), f[0], f[1]);
});

padsEl.addEventListener('pointermove', e => {
  if (!heldPointers.has(e.pointerId)) return;
  const prev = heldPointers.get(e.pointerId);
  const idx = padIndexAt(e.clientX, e.clientY);
  if (idx < 0 || idx === prev) return;
  heldPointers.set(e.pointerId, idx);
  release(prev);
  const f = fracIn(idx, e.clientX, e.clientY);
  press(idx, 0.75, f[0], f[1]);
});

function endPointer(e) {
  if (!heldPointers.has(e.pointerId)) return;
  const idx = heldPointers.get(e.pointerId);
  heldPointers.delete(e.pointerId);
  release(idx);
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', onKeyDown, { capture: true });
window.addEventListener('keyup', onKeyUp, { capture: true });
window.addEventListener('keypress', e => { if (!uiOpen()) e.preventDefault(); }, { capture: true });
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('dragstart', e => e.preventDefault());
window.addEventListener('gesturestart', e => e.preventDefault());
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAll(); else requestWakeLock();
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  resizeCanvas();
  clearFx();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const need = innerWidth >= innerHeight ? 5 : 3;
    if (need !== GRID.cols) { releaseAll(); buildPads(false); }
    else measurePads();
  }, 120);
});

/* ============================ защита от закрытия ============================ */

let kioskPaused = false;   // взрослый вышел из режима игры вручную
let wakeLock = null;

function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function blockUnload(e) { e.preventDefault(); e.returnValue = ''; return ''; }

function applyGuardListeners() {
  window.removeEventListener('beforeunload', blockUnload);
  if (S.guard && !kioskPaused) window.addEventListener('beforeunload', blockUnload);
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden) return;
  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {}
}

async function enterKiosk() {
  kioskPaused = false;
  applyGuardListeners();
  requestWakeLock();
  if (!S.guard) return;
  try {
    const root = document.documentElement;
    if (!fsElement()) {
      await (root.requestFullscreen
        ? root.requestFullscreen({ navigationUI: 'hide' })
        : root.webkitRequestFullscreen());
    }
  } catch (e) {}
  try { if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(); } catch (e) {}
}

async function leaveKiosk() {
  kioskPaused = true;
  applyGuardListeners();
  try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) {}
  try {
    if (fsElement()) {
      await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    }
  } catch (e) {}
  try { if (wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
}

function onFullscreenChange() {
  if (!started || kioskPaused || !S.guard) return;
  if (!fsElement() && settingsEl.hidden) {
    releaseAll();
    resumeEl.hidden = false;
  }
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

/* ============================ интерфейс ============================ */

const startEl = document.getElementById('start');
const settingsEl = document.getElementById('settings');
const resumeEl = document.getElementById('resume');
const gateEl = document.getElementById('gate');

function hideOverlay(el) {
  if (REDUCED || !el.animate) { el.hidden = true; return; }
  const a = el.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.04)' }],
    { duration: 260, easing: 'cubic-bezier(.4,0,.7,.2)' }
  );
  a.onfinish = () => { el.hidden = true; };
  a.oncancel = () => { el.hidden = true; };
}

document.getElementById('startBtn').addEventListener('click', () => {
  // Сначала фулскрин и блокировка клавиатуры — синхронно, пока жив жест
  // пользователя: после await Safari активацию уже не признаёт.
  started = true;
  enterKiosk();
  initAudio();
  if (ac.state === 'suspended') { ac.resume().catch(() => {}); }
  hideOverlay(startEl);
  buildPads(true);
});

document.getElementById('resumeBtn').addEventListener('click', async () => {
  hideOverlay(resumeEl);
  if (ac && ac.state === 'suspended') { try { await ac.resume(); } catch (e) {} }
  await enterKiosk();
});

/* Калитка для взрослых: удержание 1,5 с */
let holdTimer = null;
function holdStart(e) {
  e.preventDefault();
  gateEl.classList.add('holding');
  holdTimer = setTimeout(openSettings, 1500);
}
function holdEnd() {
  clearTimeout(holdTimer);
  holdTimer = null;
  gateEl.classList.remove('holding');
}
gateEl.addEventListener('pointerdown', holdStart);
gateEl.addEventListener('pointerup', holdEnd);
gateEl.addEventListener('pointerleave', holdEnd);
gateEl.addEventListener('pointercancel', holdEnd);

function openSettings() {
  holdEnd();
  releaseAll();
  clearFx();
  syncUI();
  settingsEl.hidden = false;
}
function closeSettings() {
  hideOverlay(settingsEl);
  if (started) enterKiosk();
}

document.getElementById('closeSettings').addEventListener('click', closeSettings);
document.getElementById('exitKiosk').addEventListener('click', async () => {
  settingsEl.hidden = true;
  await leaveKiosk();
});

/* Сегментированные переключатели */
function bindSeg(id, key, parse) {
  const box = document.getElementById(id);
  box.addEventListener('click', e => {
    const btn = e.target.closest('button[data-v]');
    if (!btn) return;
    S[key] = parse(btn.dataset.v);
    saveSettings();
    syncUI();
    applySettings();
    if (key === 'mode') { releaseAll(); clearFx(); buildPads(false); warmPlucks(); }
  });
}
bindSeg('optMode', 'mode', v => v);
bindSeg('optStroke', 'stroke', v => v);
bindSeg('optVoice', 'voice', v => v);
bindSeg('optChords', 'chords', v => +v);
bindSeg('optHarmony', 'harmony', v => v);
bindSeg('optKey', 'key', v => +v);
bindSeg('optFx', 'fx', v => +v);
bindSeg('optGuard', 'guard', v => +v);
bindSeg('optLang', 'lang', v => v);

const volEl = document.getElementById('optVol');
volEl.addEventListener('input', () => {
  S.vol = +volEl.value;
  document.getElementById('volVal').textContent = S.vol + '%';
  if (master) master.gain.value = S.vol / 100;
});
volEl.addEventListener('change', saveSettings);

function syncUI() {
  applyI18n();
  const marks = [['optMode', 'mode'], ['optStroke', 'stroke'], ['optVoice', 'voice'], ['optChords', 'chords'], ['optHarmony', 'harmony'],
                 ['optKey', 'key'], ['optFx', 'fx'], ['optGuard', 'guard'], ['optLang', 'lang']];
  for (const pair of marks) {
    for (const b of document.getElementById(pair[0]).querySelectorAll('button[data-v]')) {
      b.setAttribute('aria-pressed', String(b.dataset.v) === String(S[pair[1]]));
    }
  }
  volEl.value = S.vol;
  document.getElementById('volVal').textContent = S.vol + '%';

  const canLock = !!(navigator.keyboard && navigator.keyboard.lock);
  const canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  let hint = 'guardOff';
  if (S.guard) hint = canLock ? (IS_MAC ? 'guardLockMac' : 'guardLock') : (canFs ? 'guardNoLock' : 'guardNoFs');
  document.getElementById('guardInfo').textContent = t(hint);
}

function applySettings() {
  if (master) master.gain.value = S.vol / 100;
  if (!S.fx) clearFx();
  document.body.classList.toggle('no-fx', !S.fx);
  applyGuardListeners();
}

/* ============================ запуск ============================ */

resizeCanvas();
buildPads(false);
syncUI();
applySettings();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const hadController = !!navigator.serviceWorker.controller;
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.update();
      // Новая версия перехватила страницу — один раз перезагружаемся, чтобы
      // не остаться со старым CSS при новом JS.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        location.reload();
      });
    } catch (e) {}
  });
}
