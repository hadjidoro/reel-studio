# Format recipes

Scene-by-scene recipes with seconds, for 1080×1920 at 30 fps.
- Every figure, quote and claim comes from `context.md`.
- Keep the length inside each chosen platform's sweet spot (`reference/platforms/*.json`). Source recipes that are shorter than that are noted.

Adapted from MIT-licensed notes; see `ATTRIBUTION.md`.

## 1. Promo / sale (one offer)
Base 10 s, scaled to 15 s. Six-second cut: drop the product beat.

| s (10 s) | s (15 s) | Beat | What's on screen |
|---|---|---|---|
| 0–1.5 | 0–2 | Hook | Occasion + brand ("BLACK FRIDAY"), on screen at frame 0 |
| 1.5–4 | 2–5 | Discount | The big number ("40% OFF", ~200 px) pops in with overshoot; the loudest element on screen |
| 4–7 | 5–9 | Was → now | Product shot under the price; strike-through, then the new price |
| 7–9 | 9–12 | Code + deadline | Code chip + "Ends Sun 23:59", held still ≥ 2 s |
| 9–10 | 12–15 | CTA | "Shop now" + URL, clean hold (then the end card) |

**Was → now:**
1. A strike-through draws across the old price, left to right, over ~0.4 s.
2. About 0.25 s after the strike starts, the new price counts down or drops in. It lands with a small overshoot.
3. Strike and count at the same instant read as a glitch: strike first.

Use tabular numerals so the digits don't jitter.

**Numbers:**
- Type only the original price and the discount. Compute the sale price and the % off from them, and round to cents before formatting.
- Show a % for higher-priced items ("40% OFF" beats "$32 off") and a flat amount for low-priced ones ("$5 off" beats "8% off").

**Code chip:** monospace, dashed accent border, light background, held perfectly still so it can be read and screenshotted.

**Honest urgency:**
- Use only a real deadline from `context.md`.
- Never a fake ticking timer. A live countdown is acceptable only if it's computed from the real deadline. In a 6–10 s spot, a static "Ends Sun 23:59" reads cleaner.
- Hold the deadline ≥ 2 s and put it on its own line near the code, not racing the price.

**Rules:**
- One offer, one code and one CTA per video. Two deals make two videos.
- One savings accent colour reused on the badge, the strike and the CTA.
- One enter curve for every beat.
- Flag prices and deadlines to the user as time-sensitive.

**With today's scenes:** `number` (count-up of the %), `calc` (was / now rows with a total), `cta`.

## 2. Testimonial / social proof
6–12 s per quote card. For a sequence of cards, give each ~3–4 s of read time and hard-cut between them. Cross-dissolving two quotes makes both unreadable.

| s | Beat | Motion |
|---|---|---|
| 0–0.3 | Quote mark motif | scales or fades in first (the only element allowed a little bounce) |
| 0.3–1.6 | Quote lines | fade-up 14 px in reading order, ~0.2 s apart, no overshoot |
| ~1.5–1.9 | Key phrase | highlight sweeps behind *one* phrase after its line settles |
| ~1.9–2.4 | Stars | fill left→right to the real score over ~0.5 s |
| ~2.4–2.9 | Author block | name (loudest), then role · company and avatar; slides up |
| 2.9–end | Hold | everything still for ≥ 3 s, so it can be screenshotted and shared |

**Honesty rules (non-negotiable):**
- **Never fabricate.** No invented reviews, reviewers, ratings or "illustrative" quotes.
- **Only real reviews.** Use reviews recorded in `context.md`, with their source and the user's confirmation that they may be shown publicly. If none exist, use another format, such as facts or numbers from `context.md`.
- **Quote verbatim.** Don't paraphrase or trim mid-sentence. The emphasised phrase must be an exact substring of the quote.
- **Stars show the real score,** fractional if needed (4.3 shows as 4.3). If there's no rating, omit the star row; never default to 5. The stars fill *after* the quote has been read.
- **The author is the proof:** name + role/company as published. Use a real avatar or none; a stock face destroys trust.
- **No real name to show:** don't make a testimonial video. This overrides the mock-names rule only for confirmed public reviews.

**Type:**
- Curly quotes (“ ”), hang the opening mark, and bind the last two words.
- Weight 500–600. Animate only opacity and a small rise; no blur, rotation or scale on body text.

## 3. Product demo (screens or phone mockup)
Repeat this loop once per feature.

| Beat | Seconds | Rule |
|---|---|---|
| Settle on screen | 0.5–1 | let the viewer orient before anything moves |
| Cursor or finger travel | 0.4–0.8 | eased in-out path, never linear |
| Tap ripple + state change | 0.2–0.3 | ripple and screen change on the same frame |
| Zoom to focal region | 1–2 in, hold 2–4 | ≤ 2× (beyond ~3× loses context); origin on the target |
| Feature caption | during the zoom | one benefit as a noun phrase; leaves before the next transition |

| Length | Steps | Per step |
|---|---|---|
| 15 s | 3–4 | ~3.5 s |
| 30 s | 5–7 | ~4 s |
| 60 s | 8–14 | ~4–5 s |

- **Speed up by cutting steps,** never by shortening the settle and read holds.
- **Move the camera or the cursor, not both at once.**
- **One callout at a time.** Spotlight the target by dimming the rest to ~45% black, with a ring.
- **Keep tap targets and zoom points inside the centre 80% of the width.**
- **Screenshots at 2× pixel density** so zooms stay sharp.
- **Screen transitions use one language:**

| Transition | Use for |
|---|---|
| push | linear walkthroughs |
| cross-zoom | diving into detail |
| cross-fade | context switches |
| match cut | an element that persists between screens |

- The overlap is 0.3–0.5 s, and only after the tap resolves.
- **Today:** the `phone` scene, with `steps`, timed `taps` and `caption`s.

## 4. Launch (hook → tease → reveal → montage → end card)
| 30 s | 15 s | Beat | What happens |
|---|---|---|---|
| 0–3 | 0–2 | Hook | striking frame or motion, **no logo yet** |
| 3–9 | 2–5 | Tease | fragments or silhouettes of the product; cuts accelerate toward the reveal |
| 9–13 | 5–7 | Reveal | product/logo snaps to full: scale 1.18 → 1.0 in 0.18 s + white flash 0.9 → 0 over 0.25 s; hold ~1.2 s |
| 13–25 | 7–12 | Feature montage | one benefit per shot, ~0.6–1.0 s each (8–10 shots; 4–5 at 15 s): bold keyword + one visual |
| 25–30 | 12–15 | End card | logo + tagline + one CTA, still, ≥ 2 s |

- At 60 s, keep the same ≤ 3 s hook, run 14–16 montage shots in waves, and hold the end card ≥ 3 s.
- **With music:** place the reveal exactly on the drop and the montage cuts on beats. Lock the track first, then build the picture to its marks.
- **The montage uses one enter curve and one exit:** keyword pop ~0.32–0.35 s, words staggered 40 ms. Vary the content, never the grammar.
- **In our engine,** scenes cross-fade 0.3 s, so a 0.6 s scene would be half fade. Build the montage as timed elements inside one scene.

## 5. Photo slideshow / Ken Burns
| Beat | Duration |
|---|---|
| Intro card (title + date or theme) | 1.5–2 s |
| Per photo | 3–6 s (under ~2.5 s feels rushed) |
| Transition | 0.4–0.6 s cross-fade, the same everywhere |
| Caption on photo | fade in ~0.3 s after the slide settles, out ~0.3 s before it leaves |
| Outro / CTA card | 2–3 s |

**Ken Burns per photo:**
- **Scale:** start ≥ 1.05, so a pan never shows an empty edge. Zoom by +6–12%, in (1.05 → 1.11–1.17) or out (reverse). Past ~1.15 total change it reads as a crash zoom.
- **Pan:** 24–60 px of drift over the whole slide, with a slow in-out easing (sine) and no jolt.
- **Vocabulary (8 moves):** zoom in or out × drift right, left, up, down or diagonal.
- **Choice:** pick each photo's move deterministically from its index, and never repeat the previous move.
- **Anchor** the zoom origin on the subject. Without detection: portraits on the upper third, landscapes at the centre.

**Photo shapes:**
- Never stretch a photo.
- **Mixed shapes in 9:16:** use a blurred pad. A cover-fit copy behind (scale 1.15, blur ~40 px, brightness 0.7) and the contain-fit photo on top. Keep the pan smaller on contain-fit photos.
- **Photos that already match 9:16:** cover-fit.

**With music:**
- Change slides every 2 or 4 beats; every beat is too frantic. At 120 BPM, 8 beats gives 4 s.
- Put the hero photo on the drop, and give 1–2 keepers a double-length hold.
- If the music outlasts the photos, fade it over the last 1.5 s.

**Today:** the `bg` image with `bgFull`, and the `kb` animation in `html` scenes.

## 6. Ad creative (performance) and its variants
| s (25 s) | s (15 s) | Beat | Job |
|---|---|---|---|
| 0–3 | 0–2.5 | Hook | stop the scroll; trigger lands before ~2 s |
| 3–8 | 2.5–5 | Context | make the problem felt |
| 8–18 | 5–10 | Payoff | product as the solution, one clear benefit |
| 18–22 | 10–12.5 | Proof | one concrete number or demo moment (from `context.md`) |
| 22–25 | 12.5–15 | CTA | one action, message-matched to the hook, held ≥ 2 s |

**Variant matrix:**
- The body is fixed. Swap one field per test wave: hooks (5–8 of different types) → offer → CTA → length.
- Hooks ≤ ~60 characters.
- Before writing specs, fill one worksheet row per variant: hook | type | benefit | proof | CTA that pays off the hook.
- **Mixing two changes in one variant makes the winner uninterpretable.**
- See `hooks-and-retention.md` for hook types and testing order.
