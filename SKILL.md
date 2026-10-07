---
name: reel-studio
description: "Collaborative studio for short vertical promo videos (Facebook/Instagram Reels, TikTok, YouTube Shorts, LinkedIn). Interviews the user for context and useful links, asks which platforms, which theme and how many videos, gets concepts and storyboards approved, then renders 1080×1920 MP4s with a caption per platform. Run with /reel-studio."
argument-hint: "[theme or request, optional]"
disable-model-invocation: true
---

# Reel Studio

Collaborative, spec-driven video pipeline:
**profile (context + links) → campaign (platforms, theme, count) → concepts ✋ → specs → storyboards ✋ → MP4s**

✋ marks the two points where you stop and wait for the user's approval. Every video is a JSON spec, and the engine turns it into animated, brand-styled scenes (Chrome frame capture + ffmpeg).

The user started this skill on purpose. Run the steps below in order. If they passed arguments (e.g. `/reel-studio 3 tiktoks about our new pricing`), use them to pre-fill answers, but still confirm them.

## Talking to the user
- Use plain language. Say "video", "storyboard", "caption" and "safe area". Avoid jargon such as spec, fps and JSON unless the user uses it first.
- Ask, don't guess. Each question round ends your turn, and you wait for the answer.
- Keep the user's own words. Whatever they tell you about the business goes into `context.md` under "In the user's words".

## Setup: locate the CLI
The CLI is `bin/reel` in the folder that holds this SKILL.md:

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
for d in "$ROOT"/.claude "$ROOT"/.agents ~/.claude ~/.agents ~/.codex ~/.cursor; do
  [ -x "$d/skills/reel-studio/bin/reel" ] && REEL="$d/skills/reel-studio/bin/reel" && break
done
: "${REEL:=$(command -v reel)}"   # or set REEL to <this skill folder>/bin/reel yourself
$REEL doctor            # checks node, ffmpeg, Chrome; installs puppeteer-core into the skill once
```

- If ffmpeg or Chrome is missing, give the user the install command and don't try to work around it.
- Reuse `$REEL` for every command. It works from anywhere inside the project.

The workspace is per project: `.claude/reel-studio/`. Override it with `--ws DIR` or `$REEL_WS`. **Nothing in the workspace is versioned**, because its own `.gitignore` ignores everything.

```
.claude/reel-studio/
  brand.json  context.md  sources.json  assets/  sources/     ← profile, reused across runs
  campaigns/<YYYY-MM-DD>-<theme>/
    campaign.json  brief.md  specs/NN-slug.json  out/          ← one folder per run
```

## 1. Profile: context and links

Run `$REEL profile`.

**A profile exists** (exit code 0). Show the summary in a few lines: brand, language, voiceover, links, date of last fetch, number of published videos and campaigns. Then ask with AskUserQuestion:
- **Still valid**: go to step 2.
- **Edit something**: ask what changed, update it, and re-fetch only what's affected.
- **Re-fetch links**: the site or pages have changed. Do the fetch in 1c below.

Old workspaces are converted automatically, so `profile` handles them too.

**No profile** (exit code 2). Onboard as follows:

**1a. Context.** Ask one open question in plain text, inviting the user to say as much or as little as they like:
- what the business or product is, and who it's for;
- the goal of these videos (awareness, sign-ups, sales, an event…);
- tone and language (formality, tu/vous);
- anything to avoid ("Do not" rules);
- whether they want a voiceover (macOS voices) or silent videos with on-screen text.

Wait for the answer. Ask a follow-up only if something essential is missing.

**1b. Useful links.** Ask for every link that helps, in one free-text message:
- website and landing pages;
- social pages (Facebook, Instagram, TikTok, LinkedIn, YouTube);
- source code (this project, a local folder, a GitHub URL);
- docs or Drive folders;
- competitors and videos they like.

Suggest the URL found in the code (`APP_URL`, `.env.example`, README) and "this project" for code when the working directory is the product's repo.

Record the links:
```bash
$REEL init --link https://mysite.com --link https://facebook.com/mypage --link . \
           --link competitor=https://tiktok.com/@rival --link inspiration=https://… \
           --note "one-line summary of the user's context"
```
- Each link's type is detected (website, facebook, instagram, tiktok, linkedin, youtube, x, docs, github, local).
- `competitor=` and `inspiration=` tag links that aren't the user's own.
- `--unlink URL` removes a link.
- GitHub repos are shallow-cloned into `sources/`. A private repo falls back to `gh`; if that fails, ask the user to run `gh auth login`, then `$REEL sources sync`.

**1c. Fetch the links and write the profile.** Build a fact base the videos can safely draw from, then run `$REEL sources fetched`.

**Every number, claim or label shown in a video must trace to a line in `context.md` that names its source.**

- **The user's words.** Write them into "In the user's words", and turn their don'ts into the "Do not" list.
- **Code** (`local` and `github` links). Look at:
  - the README, routes and page templates or components: hero copy, CTAs and exact UI labels;
  - enums and labels, i18n strings, pricing and config.

  For large codebases, delegate the sweep to an Explore agent.
- **Website.** WebFetch the homepage, the pages in the main navigation and `/sitemap.xml`. When the live site and the code disagree, the live site wins; note the conflict.
- **Social pages.** Record:
  - audience and tone;
  - posts or videos that performed;
  - recurring questions in comments (ready-made video ideas);
  - existing videos, which seed "Already published".

  Social networks usually block anonymous fetches. Try WebFetch first, then the user's logged-in browser if browser tools are connected, else ask the user to paste the about text and 3–5 recent posts.

  Never post, comment or message on the user's behalf.
- **Docs and Drive.** Read them if they're accessible; otherwise ask the user to export or paste them.
- **Competitors and inspiration.** Note what to learn and what to avoid under "Competitors & inspiration". Never copy their branding.
- **Brand (`brand.json`).**
  - Colors come from CSS tokens or the Tailwind theme, cross-checked against the social profile and cover images.
  - Font: the Google Fonts name, or local files copied into `assets/` and listed in `font.files`.
  - A two-part wordmark, or a logo file.
  - Also set `url`, `endLine`, `tagline`, `lang`, and `voice`: a macOS voice name when voiceover is on, `null` when it's off.
- **Assets.** Copy usable logos, illustrations, screenshots and product photos into `assets/`. Note what each one shows.

## 2. Campaign: platforms, theme, count

Ask everything in **one AskUserQuestion call** with these questions:

1. **Platforms** (multiSelect): Facebook Reels, Instagram Reels, TikTok, YouTube Shorts, LinkedIn. Pre-select the platforms whose pages are in the links.
2. **Theme**: offer 3–5 themes drawn from the profile, such as a new feature, an offer, a seasonal hook, a recurring customer question, or a gap in "Already published". The user can type their own with "Other".
3. **Kind**:
   - **Series (Recommended)**: N different angles on the theme (problem, demo, proof, offer…).
   - **Variants**: N versions of one message with different hooks, for A/B testing.
4. **How many**: 3 (Recommended), 1, 5, or 10 at most.

Create the campaign:

```bash
$REEL campaign new "Back to school promo" --platforms facebook,tiktok --mode series --count 3
```

Read the preset of each chosen platform in `reference/platforms/<id>.json`. It gives the platform's safe zones, length range, caption limits, hashtag range and tone. One master video serves every platform, so:
- aim for a length inside every platform's sweet spot where possible, and say so when one platform is a stretch;
- write one caption per platform in its tone.

## 3. Concepts ✋

Present the N concepts as a table with these columns:
- **#**
- **angle**
- **hook**: the exact on-screen words
- **scenes**: as scene types
- **length**
- **platform notes**

Before writing concepts, read `reference/motion/hooks-and-retention.md`. It covers hook types, pacing, loops, CTAs, and how to design a series vs A/B variants.

Follow these rules:
- **Series**: mix the formats in `reference/craft.md`, use one angle per video, and skip topics in "Already published".
- **Variants**: share one body, and change only the hook (and the CTA if useful). Make the hooks genuinely different, e.g. question vs number vs bold claim.
- Ground every concept in `context.md`.

**Stop and wait.** The user replies in free text, such as "ok", "drop 2" or "3: punchier hook, mention the price". Revise until they approve. Then fill "Angle" and "Concepts (approved)" in the campaign's `brief.md`, and log the feedback there.

## 4. Specs and storyboards ✋

Write one spec per approved concept in the campaign's `specs/NN-slug.json`. Before writing specs, read:
- **`reference/spec-format.md`**: scene types, fields and markup.
- `reference/motion/formats.md`: scene-by-scene recipes for promo, testimonial, demo, launch, slideshow and ad variants.
- `reference/motion/typography-and-captions.md` and `reference/motion/motion-principles.md`: type sizes, reveals, subtitles, timing, transitions and a QC checklist.
- Keep to the brand voice and to facts from `context.md`.
- Mock UIs only: never real users' names, numbers or photos.
- For **variants**, write each one as a full spec file, then note in `brief.md` which hook each file tests.
- Give each spec a `captions` entry for every platform it targets, following that platform's preset.

Preview the specs:

```bash
$REEL preview --all            # the newest campaign; --campaign NAME for another
```

`preview` prints a ⚠ for each problem it finds:
- text under any chosen platform's UI zones (frames marked ⚠ on the storyboard);
- a length outside a platform's range;
- caption problems.

Fix them all before going further.

**Also QA every storyboard yourself before showing it** (Read `out/<id>/storyboard.jpg`). Look for:
- text that overflows or wraps badly;
- content under the safe zones;
- taps that miss their target;
- empty or half-faded frames;
- facts that don't match `context.md`.

Fix them and re-preview.

Use `$REEL frames <spec> --times 4.2,6` to inspect exact moments.

Then give the user `out/index.html`. It's a gallery of every storyboard, linking to each player, where they can play, scrub, step frame by frame and toggle the **Safe zones** overlay.

**Stop and wait.** The user approves everything, or lists edits per video. Iterate by editing specs, never the generated HTML. Render only the approved videos.

## 5. Render and deliver

```bash
$REEL render --all                      # voice from brand.json; --voice NAME to override, "voice": false in a spec to silence it
```

Each video gets:
- `out/<id>/<id>.mp4` (1080×1920, 30 fps, H.264 + AAC);
- `cover.jpg`;
- `caption-<platform>.txt` for each platform.

The voiceover warns when a line doesn't fit its scene. When that happens, shorten the line or raise the scene's `dur`. For a recorded voice or a music bed, set `"audio": "assets/file.mp3"`.

To deliver:
1. Copy the MP4s where the user wants them. Ask once; by default, leave them in `out/`.
2. Add the videos to "Already published" in `context.md`.
3. Log the delivery in `brief.md`.
4. Report a table of videos with length and the caption for each platform.
5. Flag time-sensitive facts such as prices, dates and commissions.

## Rules
- Facts come from `context.md` only. If a video needs a fact you don't have, find a source or drop the claim.
- Testimonials and reviews: show only real reviews recorded in `context.md` with their source, and only once the user confirms they may be shown publicly. Never invent a reviewer, a quote or a star rating. Without one, use another format.
- Promotions: prices, discounts and deadlines must come from `context.md`. A countdown must count to the real deadline.
- Don't use other companies' logos or imitate their branding. Naming them in text for comparison is fine unless a "Do not" rule says otherwise.
- Keep workspace files in `.claude/reel-studio/`, and don't add files elsewhere in the project.
- The engine lives in the skill (`engine/`, `bin/`). Improve it there when a scene type is missing, or use the `html` scene type for one-offs.
