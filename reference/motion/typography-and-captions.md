# Typography and captions

Kinetic type and burned-in captions for 1080×1920 at 30 fps (1 frame ≈ 33 ms). Adapted from MIT-licensed notes; see `ATTRIBUTION.md`.

## Set the static type first
Motion can't rescue bad type. Lock these values before animating:

| Property | Display / headline | Body / sub-line |
|---|---|---|
| Line height | 1.05–1.2 | 1.25–1.6 |
| Tracking | tighten by 1–3% (`-0.02em`) | 0 |
| Weight | 800 (minimum 700) | 500–600 |

- Split text into lines only after fonts load, or the line breaks shift between frames.
- To stop orphans, bind the last two words with `&nbsp;`.

## Words per screen
| Element | Limit |
|---|---|
| Hook title | ≤ 8 words, ≤ ~60 characters |
| Scene headline | ≤ 12 words + one short sub-line (`craft.md`) |
| Montage keyword | 1–3 words |
| Caption chunk | 1–4 words (5 max), 1–2 lines (2 max) |
| Quote line | ~32–40 characters, split at clause boundaries |
| Feature callout | a noun phrase ("One-click export"), not a sentence |

Reading time is 0.35 s per word, with at least 2.5 s per scene. Short captions need ~1–2 s per line at minimum.

## Sizes on the 1080×1920 canvas
| Element | Size |
|---|---|
| Hook / headline | ~76 px, weight 800 |
| Body / beat text | ~60 px |
| Burned-in captions | 56–80 px (≈ 8% of frame height); floor 45 px |
| Discount number (promo) | ~200 px, the loudest thing on screen |
| Quote body | ~64 px, weight 500, line height 1.25 |
| Author name / role | ~38 px / ~30 px (muted) |
| Star row | ~52 px |
| Feature caption pill (demo) | ~30–32 px, weight 600 |

When adapting from 16:9 layouts, vertical needs type ~15–25% larger.

## Contrast
- **Body text:** ≥ 4.5:1 against what's behind it. Test on the brightest and the busiest frame.
- **Text over photos or video:** use a scrim, or stroke + shadow:
  - stroke 4–6 px black (minimum 2 px), drawn behind the fill (`paint-order: stroke fill`);
  - shadow `0 4px 16px rgba(0,0,0,.55)`.
- **One accent for emphasis.** On dark backgrounds, use a light, moderately saturated accent. A max-saturation accent vibrates.
- **Meaning never in colour alone.** Pair it with a word or a mark.

## Reveal granularity
| Split | Feel | Use for |
|---|---|---|
| By line | calm, premium | multi-line headlines, quotes |
| By word | energetic | taglines, hooks, montage keywords, captions |
| By character | most kinetic | ≤ ~15-character strings only; busy on long copy |

## Reveal styles
| Style | How | Per-fragment duration | Notes |
|---|---|---|---|
| Mask rise | each line in a clipping box; text rises from 110% below to 0 | 0.5–0.8 s | most robust headline reveal; no artifacts |
| Fade-up | opacity 0→1 + rise 14–26 px | 0.3–0.5 s | default for body, quotes, captions |
| Pop | scale 0.6–0.7 → 1 with overshoot + opacity | ~0.26–0.35 s | caption words, keywords, badges |
| Blur-in | blur 12 px → 0 + opacity | ~0.7 s | soft "focus pull"; keep blur modest; not on body text |
| Directional wipe | clip from one side to fully shown | ~0.6 s | reveals without moving glyphs |
| Highlight sweep | accent bar grows left→right behind a phrase | ~0.35 s | emphasis after the line settles |
| Weight morph | variable-font weight 200→800 | ~0.8 s | only with a variable font; check axis range |
| Typewriter | characters appear in order | ~0.03–0.05 s per character | UI/search moments (our `type` animation) |

Our existing animations already cover fade-up (`up`), slide (`left`), `fade`, `pop`, `grow` (horizontal wipe-like scale) and `type`.

## Stagger
| Unit | Offset | At 30 fps |
|---|---|---|
| Lines | 60–100 ms | 2–3 frames |
| Words | 40–70 ms | 1–2 frames |
| Characters | 20–40 ms | 1 frame (sub-frame offsets collapse) |
| List items | 40–80 ms | 1–2 frames (for rhythmic `step` reveals use 0.3–0.6 s instead) |
| Quote lines | ~0.2 s | 6 frames (reading order matters more than speed) |

- **Cap a whole group reveal at ~0.6–0.8 s.** Total = (count − 1) × offset + per-item duration. If it runs over, shrink the offset or move up a level (characters → words → lines).
- **Stagger follows the reading direction:** top to bottom, left to right.
- **Easing:** enters use ease-out, `cubic-bezier(0.16, 1, 0.3, 1)`. Overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` is for pops only. See `motion-principles.md`.

## Emphasis
- **One emphasised span per screen.** Two highlights read as none.
- **It lands after its line has settled.** Emphasis that competes with the reveal cancels both.
- **Tools, in order of restraint:** accent colour (`**accent**`), weight shift, highlight sweep, a scale pop of 1.0→1.15→1.0.
- **Emphasise the customer's or source's own words.** Never emphasise a paraphrase.

## Burned-in word-by-word captions
These carry the content for muted viewers, and each new chunk doubles as a pattern interrupt.

### Timing comes from the narration
- **Use real word timings.** Take each word's start and end from the narration audio itself, via word-level transcription or forced alignment, or from the TTS engine's word-boundary events.
- **Never split a line evenly across its duration.** The drift is instantly visible.
- **Fallback:** weight each word by its syllable or character count, then verify on frames before rendering.
- **Keep captions in the audio's timebase.** For a `vo` line at `at: 1.2`, add 1.2 s to each word time. If the voice is re-generated (new voice or rate), re-derive the times; never hand-nudge offsets.

### Chunking (pages)
- Show 1–4 words at a time; 2–3 is the sweet spot.
- Start a new chunk:
  - when the chunk reaches its word limit;
  - when the span since the chunk's first word exceeds ~1.2 s;
  - at punctuation or clause breaks.
- Pick the grouping window by style:
  - ~0.2–0.5 s groups gives true word-by-word;
  - ~1.0–1.5 s groups gives short readable phrases.
- Never a wall of text: at most 2 lines on screen.

### Animation
- Each word pops in at its own start time: scale 0.6–0.7 → 1, rise ~0.18 em and fade in over ~0.26 s with overshoot, `cubic-bezier(.34,1.56,.64,1)`.
- **Active-word highlight:** the word being spoken switches to one accent colour (e.g. yellow `#FFE45E`) or gets a filled box behind it. The colour switch takes ~80 ms.
- Only the active word changes colour. Never animate every word's colour at once.

### Style
- Bold or extra-bold sans, uppercase or sentence case.
- White fill, black stroke 4–6 px and a soft shadow. Captions sit over anything, so the stroke isn't optional.

### Placement vs safe zones
- **Vertical:** caption centre band at ~62–70% of frame height (y ≈ 1190–1345). That's above the platform UI and below the main action. Never pin captions to the bottom edge.
- **Horizontal:** keep within the centre 80% of the width (x ≈ 108–972), clear of the right-hand action rail.
- **Check against our presets:** the union of the chosen platforms' `safe` zones in `reference/platforms/*.json` decides. `preview` flags overlaps.
- **Don't collide with scene text.** With captions on, keep scene headlines in the upper half. When a scene already shows the spoken words, skip captions for that line rather than duplicating them.

### Checks on frames
- **Sync:** at 2–3 sampled times, the highlighted word is the one being spoken.
- **Chunking:** no chunk exceeds 2 lines or 5 words.
- **Legibility:** the caption reads on the brightest and the busiest frame.
- **Placement:** no chunk enters a platform UI zone.

## Accessibility and delivery
- **Burn in** for social. Platforms often ignore uploaded caption tracks.
- **Sidecar file:** a plain `.srt` from the same word times is a cheap bonus for YouTube or the web, not a substitute.
