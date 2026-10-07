# Hooks and retention

How a 9:16 reel survives the swipe: what to put in the first second, how to keep the middle moving, and how to end. Times are in seconds on our 30 fps, 1080×1920 canvas. Adapted from MIT-licensed notes; see `ATTRIBUTION.md`.

## The retention contract
- **One idea per video.** If you can't state the takeaway in one sentence, it's two videos. In a series, the second idea goes in the next video.
- **Open a loop in the first ~3 s and close it at the end.** The hook poses a gap and the payoff answers it. Never answer early, and never bury the payoff under setup.
- **No dead air.** Every beat either advances the idea or resets attention. Cut intros ("Hi, today…"), slow ramps and empty holds.
- **Fix the hook first.** It gates everything after it, so it moves results more than any other edit.

## Arc of a 20 s reel (scale the body, never the hook)
| Beat | Job | Seconds | Our scenes |
|---|---|---|---|
| Hook | One frame + one line that opens the gap | 0–1 (hold to ~2.5) | `hook` / `number` / `versus` |
| Setup | Why keep watching: stakes, promise, the gap | 1–4 | `statement`, `facts` |
| Body | Deliver value, one idea per beat | 4–17 | `list`, `phone`, `calc`, `chat`, `rule` |
| Payoff + CTA | Close the loop, then one ask | 17–20 | `statement` + `cta` (+ end card) |

A 30 s reel keeps the same 1 s hook and adds body beats. A 15 s reel trims the body.

## First second
- **The hook line is readable at frame 0.** Our first scene has no fade-in, so frame 0 doubles as the thumbnail. Don't stage the hook's key words behind a `data-t` delay.
- **The strongest visual is also at frame 0.** Never fade up from black or slow-zoom into the subject.
- **Land the emotional trigger before ~2 s.** People judge in under 2 s. Keep hooks ≤ 8 words and ≤ ~60 characters so they fit high in the frame.
- **One gap only.** Two stacked hooks close neither.
- **Pattern interrupts still need text.** A snap-zoom or visual mismatch helps, but muted viewers need words.

### Hook types (vary these in A/B variants)
| Type | Template | Best for |
|---|---|---|
| Open loop | "The real reason your ___ keeps ___…" (answer withheld) | most content |
| Direct promise | "3 ways to ___ in 30 seconds" | listicles, how-to |
| Immediate benefit | "Cut your ___ in half in 7 days" | clear, quantifiable outcome |
| Problem-first | "I didn't realise how much ___ was costing me until…" | a pain that's felt but unnamed |
| Negation | "Stop doing ___." / "You're doing ___ backwards." | strong opinions, myths |
| Direct callout | "If you ___ every morning, stop." | a sharp audience segment |
| Curiosity gap | "Nobody talks about the one thing that…" | skeptical, educated audience |
| Stakes | "This ___ cost me ___. Don't repeat it." | case studies, real math |
| Listicle tease | "3 ___ (the 3rd one ___)" | sets up a forward reference |
| Visual interrupt | snap-zoom / whip / mismatch on frame 0, plus a short line | entertainment |

## Keep the middle moving
- **Make a visible change every 2–4 s.** A scene cut, a new item revealing, a count-up, a tap, a punch-in or a caption chunk all count. A static middle is where the retention curve flattens.
- **Use uneven intervals,** e.g. cuts at 0, 1.2, 3.0, 5.4, 8.0, 11.2, 14.0 s. A fixed metronome reads as boredom; uneven spacing reads as momentum.
- **In our engine,** a 20 s reel with 4–6 scenes cuts every ~3–5 s. Use in-scene reveals (`step`, timed items, phone `steps`) so something changes at least every ~3 s inside long scenes.
- **The punch-in is the cheapest interrupt:** scale 1.00 → 1.10–1.12 on the cut, with a fast settle and the origin on the subject (~50% x, 45% y).
- **Keep reading time.** Interrupts must not cut text before it's read (0.35 s per word, ≥ 2.5 s per scene, from `craft.md`).

### Pacing arc
| Phase | Scene / shot length | Energy |
|---|---|---|
| Establish (hook + setup) | longest holds that still read | low → rising |
| Develop (body) | progressively shorter | rising |
| Climax (payoff) | shortest, the biggest visual | peak |
| Resolve (CTA / end) | one long, still hold (≥ 2 s) | release |

Uniform pacing reads as flat whatever the content. Shorten toward the payoff, then let the CTA breathe.

### With a music bed (`audio`)
- Seconds per beat = 60 / BPM. At 120 BPM: 1 beat = 0.5 s, 1 bar (4 beats) = 2 s.
- Cut on phrases, not on every beat:

| Energy | Cut every | At 120 BPM |
|---|---|---|
| frantic / climax | 1–2 beats | 0.5–1 s (keywords only) |
| energetic | 4 beats | 2 s |
| moderate | 8 beats | 4 s |
| calm | 16 beats | 8 s |

- Measure the offset of beat 1. The grid rarely starts at 0:00, and ignoring it makes every cut feel "almost on beat".
- Round each beat's cumulative time, not per step, to avoid drift.
- Put the single biggest visual (the reveal, the price, the logo) on the drop.

## Loops
- A seamless loop turns re-watches into watch time. Loops work best at ~7–15 s.
- **Frame match:** the last frame has the same composition, positions and colours as frame 0, so the restart is invisible. Our auto end card breaks the match, so a loop reel sets `"end": false` and ends on a scene that mirrors the hook.
- **Sentence loop:** the last line feeds into the first ("…and that's why I never —" → hook). Platform tone notes in `reference/platforms/*.json` say where loops pay off.

## CTA
- **One action:** visit, comment, save or share. One CTA per video, and it's the last thing on screen before the end card.
- **Message match:** the CTA pays off the hook's exact promise. "Spending 2 h a day on reports?" ends on "Save 2 hours — try free", not a generic "Learn more".
- Hold the CTA still for ≥ 2 s, with no busy motion competing. The end card holds ≥ 2 s too.
- Put the CTA inside the safe area. The bottom band is where platforms stack their own buttons and captions.

## Series vs variants
**Series** (N angles on one theme):
- One idea per video, and a different format per video (see `craft.md` and `formats.md`).
- Keep one look across the series: same brand, type and motion language.
- Number the episodes ("Tip #4") to build habit.

**Variants** (A/B tests of one message):
- **Change one variable per test.** Layout, motion, colours, timing and body stay identical. A test that changes two things teaches nothing.
- **Test in funnel order:**
  1. **Hook.** The biggest lever. Test 5–8 hooks of *different types* (question vs number vs bold claim) on one body.
  2. **Offer / benefit.** Keep the winning hook and vary the promise.
  3. **CTA.** Keep the winning hook and offer and vary the closing action.
  4. **Format / length.** Same ad as a 6 s bumper, a 15 s cut and the full length.
- **The first frame belongs to the hook variable.** A new hook means a new frame 0 and thumbnail. Keep the rest of the hook scene's layout the same.
- **Hook and CTA pairing:** if each hook needs its matched CTA, treat hook + CTA as one paired variable and write that in `brief.md`. Otherwise use a CTA that fits every hook.
- Before writing specs, fill a worksheet with one row per variant: hook, hook type, single benefit, proof point, matched CTA.
- Preview one variant fully before rendering the set. A layout bug repeats in every variant.

## Sound-off design
Most vertical viewing is muted:
- Every spoken line has an on-screen equivalent, either the scene text or burned-in captions. See `typography-and-captions.md`.
- Never carry meaning in music, sound effects or voice alone. The payoff, the numbers and the CTA must all be on screen.
- Platform auto-captions are unreliable. Burn the words in.
- Don't encode meaning in colour alone. Pair colour with a word or a mark (✓ / ✕).
- Keep flashes under 3 per second (photosensitivity).

## Cutdowns from one master
- **15 s:** keep the hook and payoff, drop middle beats, and re-time rather than trim. Keep the brand and the CTA.
- **6 s bumper:** one beat (the hook or the payoff) plus the logo, readable on mute.

## Reading a retention curve (when the user shares analytics)
| Symptom | Likely cause | Fix |
|---|---|---|
| Cliff at 0–2 s | weak hook, slow first frame | new hook type; lead with the best frame |
| Steady gentle decline | normal | — |
| Flat, then a drop mid-video | sparse changes, low-energy body | add reveals; cut every 2–4 s |
| Bump near the end | viewers loop | tighten the loop; shorten total length |
| Spike at one moment | re-watched beat | move that beat up, or make it the hook |
