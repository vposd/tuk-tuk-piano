# Tap Tap Piano

A safe piano toy for babies and toddlers (≈11 months – 3 years), built as a single-page PWA.
Every key, and every tap anywhere on the pads, makes a pleasant sound. The keyboard is locked
so a child mashing keys can't close the page, print, refresh or open a new tab.

No build step, no dependencies, no network at runtime — plain HTML/CSS/JS with Web Audio.

## Run locally

```bash
node tools/serve.js        # http://localhost:8123/
# or: npm start
```

`localhost` counts as a secure origin, so the PWA, service worker and keyboard lock all work
without HTTPS while developing.

## Deploy

It's a static folder, so any static host works. Relative paths are used everywhere, so it also
works from a subdirectory. Pick one:

**Cloudflare Pages** — recommended (free, fast worldwide, custom domains):

```bash
npx wrangler login                                             # opens a browser once
npx wrangler pages deploy . --project-name tap-tap-piano       # → https://tap-tap-piano.pages.dev
```

**Netlify** — zero setup: drag this folder onto <https://app.netlify.com/drop>. Or:

```bash
npx netlify-cli deploy --prod --dir .
```

**Vercel**:

```bash
npx vercel --prod
```

**GitHub Pages** — free and permanent:

```bash
git init && git add . && git commit -m "Tap Tap Piano"
gh repo create tap-tap-piano --public --source=. --push
gh api -X POST repos/:owner/tap-tap-piano/pages -f source[branch]=main -f source[path]=/
# → https://<user>.github.io/tap-tap-piano/
```

`_headers` (honoured by Cloudflare Pages and Netlify) keeps `index.html`, `app.js` and `sw.js`
uncached so updates land immediately, and caches icons for a year. `.nojekyll` is there for
GitHub Pages.

After deploying, HTTPS is what unlocks fullscreen, keyboard lock, wake lock and installability.

## Install as an app

- **Windows / macOS / Linux (Chrome, Edge)** — open the URL, then the install icon in the address
  bar, or menu → *Cast, save and share* / *Install*. The installed window has no tabs or address
  bar, which removes most of what a toddler could poke.
- **Android (Chrome)** — menu → *Add to home screen*.
- **iPhone / iPad (Safari)** — Share → *Add to Home Screen*.

## Keeping a child inside the app

Tap **Play** once: that grants audio, requests fullscreen, locks the keyboard and keeps the
screen awake. What that actually blocks depends on the platform — the settings panel shows the
honest status for the device you're on.

- **Windows / Linux, Chrome or Edge** — Keyboard Lock captures Esc, Tab, Alt+Tab, Ctrl+W, Ctrl+T,
  Ctrl+N, F5, F11 and friends. **Alt+F4 and Ctrl+Alt+Del cannot be blocked by any web page.**
  For a stricter setup, launch a kiosk window:
  `msedge --kiosk http://your-url --edge-kiosk-type=fullscreen --no-first-run`
- **macOS, Chrome or Edge** — same lock: Esc, Cmd+W, Cmd+T, Cmd+Tab are captured in fullscreen.
  There is no Ctrl+Alt+Del on a Mac; the one thing no browser can block is **Cmd+Q** (and Force
  Quit). If you need a hard lock, use Screen Time to allow only this app/site, or hand the child
  an iPad in Guided Access.
- **Safari** — no Keyboard Lock API. Install to the Dock/Home Screen and it runs chrome-less.
- **iPhone / iPad** — install to the Home Screen, then **Guided Access**
  (Settings → Accessibility → Guided Access, then triple-click the side button). This is the
  strongest lock on any platform: the child cannot leave the app at all.
- **Android** — install, then **screen pinning** (Settings → Security → App pinning), or Kids Space.

A `beforeunload` guard also asks for confirmation before the page is closed, which stops most
accidental one-key exits. Leaving is deliberate: hold the ⚙ button in the corner for 1.5 s →
*Exit kid mode*.

## Settings (for grown-ups)

Hold ⚙ in the top-right corner for 1.5 seconds — long enough that a baby's random taps won't
open it. Everything is stored in `localStorage`.

| Setting | Options | Notes |
| --- | --- | --- |
| What the pads play | Single notes (default), Guitar chords | Guitar mode puts 15 named campfire chords on the pads — see below |
| Instrument | **Marimba** (default), Piano, Bells, Flute | Synthesised, no samples to download |
| Chords | Single note / Chord | Chords are stacked scale tones, spread over 14 ms |
| Dissonance | **No** (default) / Yes | See *How it stays consonant* below |
| Key | C, D, F, G, A | Transposes the whole pad grid |
| Volume | 0–100 % | Feeds a limiter, so mashing never clips |
| Effects | On / Off | The spark burst on the canvas |
| Close protection | On / Off | Fullscreen + keyboard lock + close confirmation |
| Language | Auto, English, Русский, Español, Deutsch | *Auto* follows the browser locale; English is the fallback |

## How it stays consonant

With **Dissonance: No** the 15 pads are mapped to a major pentatonic scale
(`0 2 4 7 9`, three octaves from **A3**, i.e. 220–1760 Hz). That set contains no semitones and no tritones — the
smallest interval between any two pads is a whole tone — so two presses in a row, or ten fingers
at once, cannot produce a harsh interval. Chords stack scale steps (`i`, `i+2`, `i+4`), which
yields only triads and gentle sus/add colours. This is verified by test: every pad pair is
checked for intervals of 1, 6 and 11 semitones.

With **Dissonance: Yes** the pads become chromatic (semitone per pad, C3 upward, so the Key
buttons name the note you actually hear) and chords are plain major triads — a normal little piano,
where neighbouring keys do clash.

## Guitar chord mode

Switch **What the pads play** to *Guitar chords* and the 15 pads become the campfire chords,
labelled with their names and laid out by family:

| | | | | |
| --- | --- | --- | --- | --- |
| A7 | D7 | G7 | B7 | F |
| Em | Bm | D | A | E |
| **Am** | **Dm** | **E7** | C | G |

The bottom row is the key of A minor — the first three pads are the three chords half the Russian
yard songbook is built from — the middle row covers the guitar-friendly major keys, and the top row
holds the dominant sevenths.

Each pad holds a **real open-position voicing** in standard tuning (E2 A2 D3 G3 B3 E4), muted
strings included, e.g. `Am = x02210 → 45 52 57 60 64` and `G = 320003 → 43 47 50 55 59 67`. All
fifteen are checked by test: the pitch classes each voicing produces are compared against the
chord's formula, so no pad can be labelled one thing and sound like another.

The sound is a **plucked string, not stacked oscillators** — Karplus–Strong: a short filtered noise
burst circulates in a delay line one period long, averaged with its neighbour on each lap, which is
exactly how a real string loses its overtones. It is rendered offline into a cached `AudioBuffer`
per note, because a feedback loop built from Web Audio nodes is quantised to a 128-sample render
block and simply cannot tune above ~375 Hz. The delay line is read with **fractional
interpolation** and is shortened by the half-sample phase delay the loop filter adds; measured
across nine strings from E2 to G4, the tuning error is **0.0 cents**.

A press strums downward: strings enter **22 ms** apart with a slight drop in velocity toward the
top. A strum is one gesture of the hand, so guitar mode allows **one chord per 90 ms** (single
notes allow three per 40 ms) — two chords inside that window would be twelve overlapping strings of
mud. The voice ceiling rises from 16 to 26 for the same reason. All 22 distinct strings are
pre-rendered in idle time when the mode is switched on (28.7 ms of work spread across idle frames,
10 MB of buffers), so the first strum costs nothing.

The instrument, chord, dissonance and key settings apply to note mode only.

## Reviewed by a child psychologist, a Montessori guide, a UX auditor and an interaction designer

Four specialists reviewed the running code independently. Their advice is in the product, and where
they contradicted each other — or the parent's own requirements — the resolution is recorded here.
Everything below is measured, not asserted; the numbers come from scripted probes over the
DevTools protocol against this build.

### What the developmental psychologist changed

| Finding | Measured before | Now |
| --- | --- | --- |
| Press highlight was an unrate-limited flash. `.lit` brightened a pad by 7.8–14.9 % of full scale over an area 6.3× the WCAG safe-flash area, and nothing limited how often it could fire | +7.8 … +14.9 % on 10 of 15 pads | Press now **darkens** the pad: **−1.3 … −3.5 %**. Feedback is carried by a bright edge and core, not by area brightness, so a flash is structurally impossible however fast the child hits it |
| Sparks were effectively a white strobe (`hsla(h,100%,95%)`) | ΔY 0.53–0.67 vs the pad | Core lightness is solved per pad so the rise is exactly **ΔY 0.20** (limit 0.26) |
| Same pad could re-flash at any rate | unlimited | Re-press inside **340 ms** produces a brightness *dip*, not a new flash — max 3 Hz per pad |
| Feedback outlasted the act, reading as decoration rather than consequence | sparks 650 ms, wave 640 ms, icon pop 700 ms | 600 / 560 / 480 ms with an `alpha ∝ life^1.3` curve, so the perceptible part ends in ~300 ms |
| Randomness in the press path broke one-to-one predictability — the thing an 11-month-old is actually testing | keyboard velocity random 0.82–1.00 (1.7 dB), wave origin random 0.3–0.7, oscillator detune ±3 cents | velocity fixed **1.0**, origin fixed **centre**, detune **0**. The same act now yields the same result |
| A palm slap fired eight independent notes | 8 notes, 16-voice ceiling | max **3 notes per 40 ms** window (a pentatonic chord, not mud); every touched pad still lights |
| Pitch sat where infant hearing is weakest and laptop speakers roll off | 131–880 Hz from C3 | **220–1760 Hz** from A3 (`BASE_MIDI.soft` 48 → 57) |
| Long decays under a slap became an unattributable wash; one bell partial reached 7.8 kHz | piano 2.6 s, bells 3.0 s, partial 8.9× | decay capped at **1.2 s**, the 8.9× partial removed, **marimba** is the default voice |
| Notes were scheduled exactly at `currentTime` and could land mid-quantum | — | scheduled at `currentTime + 5 ms` |

Latency was measured rather than assumed: the keydown handler runs **1.2–3.4 ms** after the event,
the first frame lands **0.6–2.4 ms** later, and the audio path adds **50 ms**
(`baseLatency` 10 ms + `outputLatency` 40 ms) — inside the 100 ms contingency budget for this age,
with the 200 ms hard fail far away.

**Deliberately not done:** the psychologist's optional "echo" turn-taking feature (replaying the
child's last notes after a pause) — it is a good idea for a 2–3-year-old, but it adds sound the
child did not produce, and that is a rule this toy keeps.

### What the Montessori guide changed

- **Isolation of a single quality.** Shape used to vary independently of everything else (10 shapes
  cycled over 15 pads, so five pairs of pads differed by hue alone). Now there are **five shapes for
  the five pentatonic degrees**, repeated in every row, and **size encodes the octave** — low notes
  carry the largest shape, like the long bars of a xylophone. Colour, position, shape and size now
  all say the same thing about pitch instead of four different things.
- **Order.** The old rainbow was a *circle*: `hue = (350 + step*24) % 360` put the lowest and the
  highest note within 24° of each other, so the two ends of the instrument looked the same. Hue is
  now monotonic across a 238° arc and lightness rises with pitch, so the grid reads as three
  parallel ramps.
- **Control of error.** Repetition is how a child verifies a result, so the same key must sound
  identical every time — this is why the randomness above was removed. It was the guide's point and
  the psychologist's independently.
- **Reality over entertainment.** Marimba is the default: a struck wooden bar really is a
  fast-decaying near-pure tone, so the synthesis is honest about what the hand did. A tapped flute
  has no cause in a child's hand, so it is no longer the kind of sound the toy leads with.
- **Purposeful, not decorative.** The idle animations are gone — nothing on screen moves unless the
  child moves it.

**Where the guide was overruled, and why:**

1. *"Turn the close protection off (`guard: 0`): freedom of choice includes the freedom to stop."*
   Rejected. Keeping the child out of the rest of the laptop is the reason this app exists; the
   parent, not the software, decides when it is over. The protection stays on by default and is
   switchable in one tap.
2. *"Remove the sparks entirely."* Reduced instead of removed: **8 sparks per press**, rising from
   the touch point, gone in 600 ms, capped in count and brightness by the numbers above. They are
   the acknowledgement that the pad answered, and the parent asked for visible feedback.
3. *"Drop to 5–10 pads and one shape."* Kept 15 pads and 5 shapes: three octaves is what makes the
   instrument worth returning to at two and three years old, and the pads are still ~160 px on the
   short side of a phone in portrait.

### Convergent findings

Three of the four reviewers independently flagged the same two defects, which is why they were
fixed first: the white shape icons were invisible (contrast **1.07–1.73:1**; now a dark ink at
**3.3:1** at rest and **5.0:1** pressed), and the palette had a **5× luminance spread**
(L\* spread 43.9; now **9.1**, with ΔE between neighbouring pads 12.6–34 instead of 6.5–50, so no
two pads are perceptually identical any more).

## Keyboard mapping

Physical keyboard rows map onto pad rows, left to right, so the layout feels spatial: the number
row plays the top pad row, the space bar row the bottom one. Modifiers (Shift, Ctrl, Alt, Cmd,
Caps Lock, Tab, Esc, Enter) all make sound too — a child presses those constantly. Anything not
in the table (F-keys, arrows, numpad, media keys) is hashed onto a pad, so **no key is silent**.

Auto-repeat is ignored, so holding a key does not machine-gun the note.

## Design notes

- **Flat, current visual style.** Tiles are a single soft gradient with a hairline light edge and
  one ambient shadow underneath — no glossy top sheen and no inset top/bottom bevels.
- **A press darkens the pad; it never flashes.** The highlight layer is a bright core inside an
  overall dimming, so the area-weighted luminance *drops* 1.3–3.5 % while the edge and the core
  gain contrast. Fading in over 60 ms and out over 420 ms, with a brightness dip instead of a
  re-flash inside 340 ms, this is incapable of strobing no matter how fast the pads are hit — the
  earlier version brightened them by up to 14.9 %, which is over the WCAG general-flash threshold.
  The canvas draws with `source-over` (never additive), so overlapping presses cannot accumulate
  into a white flash either. Screen-wide flashes, expanding rings and motion trails are gone — the
  rings in particular read as ugly concentric circles.
- **The palette is computed, not picked.** 15 hues on a monotonic 238° arc at near-constant
  perceived lightness: L\* spread **9.1** (the naive hue wheel scored 43.9, i.e. the yellow pads
  were twice as bright as the blue ones), ΔE between neighbours **12.6–34** so no two pads look
  alike, and a dark shape ink at **3.3:1** at rest / **5.0:1** pressed (white ink at 30 % scored
  1.07:1 — invisible). Every spark's core lightness is solved per pad so its luminance rise is
  exactly 0.20.
- **Nothing animates while idle.** No drifting background, no floating shapes, no glossy sweep:
  those kept the GPU busy permanently and made every press look like a slideshow on integrated
  graphics. Motion happens only in response to a press.
- **60+ fps under abuse.** Everything animated is composited: pad travel is a CSS transition on
  the separate `scale` property, the entrance animation owns `transform`, and the wave and shape
  pop are Web Animations on plain `div`s (never on the `<svg>` — Chrome can't composite that).
  The wave layer is a small element scaled up by transform instead of a pad-sized raster; the
  particle canvas clears only its dirty rectangle and never renders below CSS resolution; at most
  four presses per 120 ms get a wave and particles, and the same pad at most once per 340 ms (a
  palm on the keyboard produces ten identical waves nobody can tell apart); and an auto-quality
  loop watches frame times and thins the particles out on slow hardware. Measured on integrated
  AMD graphics at 2560×1440: normal play (10 presses/s) mean frame **8.6 ms**, p95 12.6 ms, 7 long
  frames out of 464; a palm smash (83 presses/s) mean 14.9 ms.
- **Audio** is one `AudioContext`: additive oscillator voices (plus a noise transient for piano)
  → lowpass → generated convolution reverb → limiter. 16-voice ceiling with oldest-voice stealing,
  and at most three note onsets per 40 ms, so a palm on the keyboard yields a chord instead of mud.
  Notes are one-shot, decay in at most 1.2 s and are scheduled 5 ms ahead — holding a key never
  sustains, because ten held keys turn into a drone. Identical presses are bit-identical: fixed
  velocity, no detune jitter.
- **The FX canvas needs an explicit `width`/`height` in CSS.** `<canvas>` is a replaced element,
  so `inset: 0` does *not* stretch it — it takes its intrinsic size from the width/height
  attributes. Without `width: 100%; height: 100%` everything drawn lands offset by the device
  pixel ratio on any screen at 125 %/150 % scaling or on Retina, i.e. sparks appear over the
  neighbouring pad.
- **Geometry** comes from `offsetLeft`/`offsetWidth`, not `getBoundingClientRect()`: during the
  entrance animation the pads are scaled, so rect-based measurements were offset — particles flew
  out of the wrong place and touches landed on the wrong pad.
- **Responsive**: 5×3 pads in landscape, 3×5 in portrait, re-laid out on rotation with the
  keyboard map recomputed. Safe-area insets keep pads clear of notches and home indicators; the
  settings sheet scrolls by touch while the play area stays gesture-proof (`touch-action: none`).
- **Accessibility**: `prefers-reduced-motion` (Windows *Animation effects: off*, macOS
  *Reduce Motion*) drops the entrance stagger, the pad travel, the wave, the shape pop and the
  sparks, and **keeps the colour response**, which is not motion — a toy with no answer to a press
  is broken, not accessible. `:focus-visible` rings, a `forced-colors` block and page zoom
  (`user-scalable` is no longer suppressed) are in place; the pad grid is `role="application"`
  with a screen-reader line explaining that any key plays a note.

## Files

```
index.html              markup and settings panel
styles.css              layout, pad look, all CSS animation
app.js                  audio engine, note mapping, input, particles, kiosk guard
i18n.js                 en / ru / es / de strings + locale detection
manifest.webmanifest    PWA manifest (fullscreen display)
sw.js                   cache-first service worker, works fully offline
icons/                  generated PNG icons + favicon.svg
tools/serve.js          zero-dependency dev server
tools/make-icons.js     regenerates the PNG icons (npm run icons)
_headers                cache/security headers for Cloudflare Pages and Netlify
```

## Updating a deployed copy

The service worker is **network-first for `index.html`, CSS and JS** and cache-first only for
icons, so a deploy reaches devices on the next load instead of being pinned to an old build. When
a new worker takes over an already-controlled page, the page reloads itself once — that avoids the
nastiest failure mode of the naive cache-first setup: new `app.js` running against old
`styles.css`, which silently kills the press animations.

When you change assets, bump `VERSION` in `sw.js` and the `?v=` query on the script/style tags in
`index.html`. If a browser ever still looks stale, one hard reload (Ctrl+Shift+R, or Cmd+Shift+R)
clears it.
