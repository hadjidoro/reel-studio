# Motion principles

Engine-agnostic numbers for how things move: easing, durations, overshoot, stagger, scene transitions and colour. The QC list at the end applies to our storyboards and frames. 30 fps means 1 frame ≈ 33 ms. Adapted from MIT-licensed notes; see `ATTRIBUTION.md`.

## Easing
| Action | Curve | cubic-bezier |
|---|---|---|
| Enter / appear | ease-out (fast start, gentle settle) | `0.16, 1, 0.3, 1` (expo), or the safer `0.33, 1, 0.68, 1` (cubic) |
| Exit / leave | ease-in (accelerates away) | `0.7, 0, 0.84, 0` (expo), or `0.32, 0, 0.67, 0` (cubic) |
| Move while on screen, camera | ease-in-out | `0.65, 0, 0.35, 1` |
| Ken Burns drift | slow ease-in-out (sine) | `0.37, 0, 0.63, 1` |
| Playful pop / branded | overshoot (back) | `0.34, 1.56, 0.64, 1` |
| Anticipate + overshoot | back in-out | `0.68, -0.6, 0.32, 1.6` |
| Continuous loops only | linear | — |

- **Linear reads as robotic** on any discrete event.
- **The eye forgives a slow end more than a slow start.** When unsure, decelerate into rest.
- **Snappy feel:** a short launch and a long settle, i.e. asymmetric easing.

## Durations by element
| Element | Duration |
|---|---|
| Tap feedback, ripple | 0.1–0.3 s |
| Small badge / chip pop | ~0.15–0.35 s |
| Text fragment enter (word, line) | 0.4–0.6 s (our default `data-d` 0.55 s fits) |
| Card / list item enter | 0.4–0.5 s each |
| Hero headline / full-screen element | 0.5–0.8 s |
| Exit | 0.2–0.3 s (exits are faster than enters) |
| Number count-up | 0.6–1.2 s, ease-out |
| Camera push / pan, punch-in settle | 0.8–2 s (punch-in: a fast spring, ~0.3 s) |
| Background gradient drift | 8–20 s, ease-in-out alternate |

- **Bigger or farther means longer.** Duration ≈ base × √(distance ratio), e.g. 0.3 s for 200 px gives 0.6 s for 800 px.
- **Diagnosis:** floaty means too long, so cut 30% and sharpen the curve. Robotic means linear or symmetric easing on an enter.

## Overshoot, anticipation, follow-through
- **Overshoot** (scale or position goes ~10–15% past the target, then settles):
  - use it for pops, badges, discount numbers, CTA buttons, check marks and caption words;
  - never on testimonial body text, premium or corporate pieces, or long copy.
- **Anticipation:** a 60–120 ms dip before a launch (scale 0.95, or 8 px the opposite way). Good on CTA buttons and taps.
- **Follow-through:** attached parts settle 40–80 ms after the lead (a card lands, then its label, then its sub-line). Don't stop everything on one frame.
- **Reveal impact:** scale 1.18 → 1.0 in 0.18 s, plus a white flash at 0.9 → 0 opacity over 0.25 s. Use it once per video at most.

## Stagger and simultaneity
- **Lists:** 40–80 ms per item. Dense grids: 20–40 ms.
- **Text** (lines / words / characters): 60–100 / 40–70 / 20–40 ms. At 30 fps, anything under 33 ms collapses to the same frame.
- **Group cap:** (n − 1) × offset + per-item duration ≤ ~0.8 s. Our rhythmic `step` reveals (one item per beat, 0.3–0.6 s apart) are a deliberate exception: each item is its own event.
- **One-third rule, two forms:**
  - **Distance:** nothing travels more than ~1/3 of the frame (≈ 360 px wide / 640 px tall) in one unbroken move without a scale or opacity change. Otherwise it reads as "the template moved".
  - **Simultaneity:** with 3+ elements, at most ~1/3 are in active motion at once.
- **One focal point per frame.** Hierarchy goes size > contrast > colour > position.
- **Direction:**
  - new content enters from the right or below, following reading direction; going back reverses it;
  - elements enter and leave by the nearest edge.

## Scene transitions
Hard cut is the default. Every other transition needs a reason.

| Transition | Duration (overlap) | Motion | Use when | Avoid |
|---|---|---|---|---|
| Hard cut | 0 | — | most cuts, beat cuts, between quote cards | — |
| Cross-fade | 0.3–0.6 s (our default 0.3 s) | opacity overlap | calm context switch, slideshows | between two text-heavy scenes (unreadable midpoint); on every cut of a beat edit |
| Push / slide | 0.3–0.5 s | both scenes translate together, toward reading direction | "next step" in walkthroughs | long-distance moves without easing |
| Wipe | ~0.4–0.6 s | directional clip reveal | time passing, softer mood, before/after | overuse reads amateur |
| Zoom-through (cross-zoom) | 0.3–0.5 s | outgoing scale 1 → 1.15 + fade; incoming 1.08 → 1.0 | diving into a detail or a sub-view | premium/calm pieces |
| Whip | ~0.28 s per side (6–10 frames of blend) | outgoing −120% in x, ease-in + horizontal motion blur; incoming from +120%, ease-out, overlapped | energetic scene jumps, playful/hype | corporate, testimonials |
| Match cut | 0 (1–2 frame tolerance) | a shared shape, position or vector registers across the cut | an element persists (card, logo → wheel) | mismatched positions |
| Punch-in | cut + 0.3 s settle | scale 1.0 → 1.10–1.12 | pattern interrupt with no new content | every cut |

- **One transition family per video,** plus hard cuts. Mixing wipes, spins and zooms screams "template".
- **Cut on action:** cut while something is mid-move, never mid-cursor or before a tap resolves.
- **Transitions don't fix bad timing.** Fix the cut point first.

### Personality → rhythm
| Personality | Hold per scene | Transitions | Motion |
|---|---|---|---|
| Premium | long (≈ 8–16 beats) | hard cut + occasional cross-fade | slow, no overshoot, slow pushes |
| Corporate / trust | steady (≈ 8 beats) | hard cut, clean | ease-out, minimal overshoot |
| Playful | ≈ 4 beats, syncopated | match cuts, quick whips | bouncy overshoot |
| Energetic / promo | 1–2 beats at the climax | hard cuts, whips, snaps | fast springs, punch-ins |

Map the user's vague words to a row: "premium" = slow easing, restrained palette, breathing room; "punchy" = holds under 1 s, overshoot, big scale jumps.

## Camera moves (backgrounds, photos, screens)
- **One camera move per beat:** push, pan or parallax. Never push + pan + rotate together.
- **Push-in:** scale 1.0 → 1.10–1.12 over ~1.6 s, ease-in-out, origin on the subject.
- **Pull-out:** scale 1.15 → 1.0 over ~1.8 s.
- **Parallax speeds:** background 0.1–0.3×, midground 0.5–0.7×, foreground 1.0–1.5×.

## Colour in motion
- **Palette:** 1 primary + 1 accent + 2–3 neutrals. Get contrast from lightness, not from more hues.
- **Neutrals:** tint them slightly toward the primary hue.
- **Colour transitions and gradients:** interpolate in OKLCH (CSS `linear-gradient(in oklch, …)`). Raw sRGB mixing goes muddy or grey mid-way (blue → yellow through grey).
- **Premium backgrounds:** stacked soft radial gradients drifting over 8–20 s, plus 3–5% grain. The grain also hides banding after H.264 compression.
- **Colour change durations:** state changes 0.15–0.3 s; full-screen washes 0.4–0.8 s.
- **One emphasis accent per video,** e.g. savings red/green in promos.
- **Brightness check:** judge brightness in Chrome, not QuickTime, which adds a gamma shift. Washed-out or crushed blacks mean a range or colour-tag mismatch. Tag the MP4 BT.709 with limited range; `ffprobe` should report bt709.

## QC on storyboards and frames (`$REEL preview`, `$REEL frames --times …`)
**Open and close**
- [ ] Frame 0: the hook text is fully visible (not mid-fade) and is the strongest visual. No black or blank first frame.
- [ ] Last frame: it ends on the intended frame. For loops, last ≈ first.

**Text and facts**
- [ ] All text spell-checked: names, prices, URLs, codes. Every number traces to `context.md`, and computed prices agree.
- [ ] Each scene holds ≥ reading time (0.35 s per word, ≥ 2.5 s). Legal or deadline lines are held long enough to read.
- [ ] No text overflow, bad wraps or orphans. Type on images survives the brightest and the busiest frame.

**Layout and motion**
- [ ] Nothing critical in any chosen platform's UI zone (union of presets); `preview` shows no ⚠.
- [ ] One focal point per frame. Stagger tails ≤ ~0.8 s. No two primary moves at once.
- [ ] Transitions come from one family. No text-heavy scene cross-fades into another text-heavy scene.

**Format-specific**
- [ ] Captions: the highlighted word matches the narration at the sampled times; ≤ 2 lines; inside the caption band.
- [ ] Photos: none blank or stretched; no empty edge during Ken Burns; no two adjacent slides with the same move.
- [ ] Taps land on their targets. Ripple and state change share a frame. Zoom ≤ 2×.
- [ ] Counts land on the exact final value. The strike-through sits on the old price.
- [ ] The CTA pays off the hook, holds ≥ 2 s, and nothing moves under it. The end card holds ≥ 2 s.

**Audio and delivery**
- [ ] The voice fits each scene (no warnings), no clipping, music faded over the last ~1.5 s.
- [ ] Output 1080×1920, 30 fps, H.264 + AAC (8–12 Mbps is typical for 1080p social). Play the file once outside the editor.
- [ ] For batches and variants: preview one representative spec fully before rendering the rest.
