---
name: reel-studio
description: "Plans, previews and renders short vertical promo videos (Facebook/Instagram Reels, TikTok, YouTube Shorts) for a product or website. Onboards by asking for the Facebook page, the website and the source code (this project, a local folder or a GitHub URL), gathers context from them, proposes reel scripts, builds a scrubbable HTML preview and storyboard to iterate on, then renders 1080×1920 MP4s with covers and captions (optional TTS voiceover). Use when the user asks for reels, shorts, TikToks, social videos, promo/marketing videos, or more videos for their page."
---

# Reel Studio

Spec-driven reel pipeline: **context → scripts → JSON specs → preview/storyboard → iterate → MP4**.
Every reel is a JSON file; the engine turns it into animated brand-styled scenes (Chrome frame capture + ffmpeg).

```bash
REEL=~/.claude/skills/reel-studio/bin/reel   # bash wrapper around reel.mjs; run from anywhere inside the project
$REEL doctor            # first run: checks node, ffmpeg, Chrome; installs puppeteer-core into the skill once
```

Workspace (per project): `.claude/reel-studio/` → `sources.json` (Facebook page, website, code location), `brand.json`, `context.md`, `specs/*.json`, `assets/`, `sources/` + `out/` (git-ignored).
Override with `--ws DIR` or `$REEL_WS`.

## Workflow

### 1. Install & onboard (once per workspace)
1. `$REEL doctor`. If ffmpeg or Chrome is missing, give the user the install command and don't work around it.
2. If `.claude/reel-studio/sources.json` exists, run `$REEL sources`, read `brand.json` and `context.md`, and skip to step 3. Re-run onboarding only when a source is missing or the user wants to change one.
3. **Ask the onboarding questions.** Ask them all in one go, and don't guess the answers.
   - **Facebook page URL.** This is where the reels will be posted. It tells you the page's audience, tone and what already performs. The user can answer "none".
   - **Website URL.** This is the live product. Offer the one found in the code, such as `APP_URL`, `.env.example` or the README, as the likely answer.
   - **Where is the source code?** Ask with AskUserQuestion using these options:
     - **This project.** Recommended when the working directory is the product's repo.
     - **Another local folder.** The user types the path.
     - **A GitHub repo.** The user types the URL. `https://github.com/org/repo`, `…/tree/branch` and `github:org/repo` all work.
     - **No code, website only.**

   Put the URL questions in the same message as that question, or use AskUserQuestion's free-text "Other" answer.
4. Record the answers. Re-running with any single flag updates only that answer.
   ```bash
   $REEL init --facebook https://facebook.com/mypage --website https://mysite.com --code .            # this project
   $REEL init --facebook none --website mysite.com --code ~/code/other-app                          # another folder
   $REEL init --facebook … --website … --code https://github.com/org/repo [--ref main]               # GitHub (shallow clone)
   $REEL init --facebook … --website … --code none                                                  # website only
   ```
   - A GitHub repo is shallow-cloned into `.claude/reel-studio/sources/<repo>`, which is git-ignored.
   - A private repo falls back to `gh`. If that fails, ask the user to run `gh auth login` and then `$REEL sources sync`.
   - `$REEL sources sync` refreshes the clone before a new batch.
   - When the user isn't inside a project, the workspace is created in the current folder.

### 2. Gather context: write `context.md` and `brand.json`
Build a fact base the reels can safely draw from. **Every number, claim or label shown in a reel must trace to a line in `context.md` with its source.** Record which sources were used and when at the top of `context.md`.
- **Source code.** Read the folder that `$REEL sources` prints.
  - Look at the README, routes and page templates or components: hero copy, CTAs and exact UI labels.
  - Also check enums and labels, i18n strings, markdown, blog or guide content, pricing, and config such as `APP_URL`.
  - When the codebase is large, delegate a broad sweep to an Explore agent pointed at that folder.
- **Website.** WebFetch the homepage, the pages linked from the main navigation, and `/sitemap.xml` if it exists. Use them to confirm the copy is live and to pick up claims that aren't in the code. The live site wins when it disagrees with the code, and you should note the conflict.
- **Facebook page.** Note the page name, category, about text, recent post topics, tone, which posts and reels get engagement, and recurring questions in comments. Those questions are ready-made reel ideas.
  - Facebook usually blocks anonymous fetches. Try WebFetch first.
  - If that fails and browser tools such as Claude in Chrome are connected, read the page in the user's logged-in browser.
  - Otherwise ask the user to paste the about text and 3–5 recent posts. Never post, comment or message on the user's behalf.
- **Brand.**
  - Colors come from CSS tokens or the Tailwind theme.
  - For the font, use the Google Fonts name if there is one. Otherwise copy local font files into `assets/` and reference them via `font.files`.
  - Use a two-part wordmark for a two-tone logo, or a logo file.
  - Also record the domain, a one-line end-card slogan, and the tone: formality, tu/vous, language.
  - Where code and page differ, the Facebook page's profile and cover images are a good cross-check for colors.
- **Assets.** Copy usable illustrations, logos and screenshots into `assets/`. SVGs scale best. Note what each shows and good `bgPos` values.
- **Rules.** Record the user's constraints under a "Do not" heading, for example brands not to name. Honour them in every spec.
- Keep an "Already published" table so new ideas don't repeat. Seed it from the Facebook page's existing reels.

### 3. Propose scripts
Present ideas as a table: **#, audience, hook (exact on-screen words), beats (scene types), why it works, caption.** Default 6–10 ideas, mixing formats (see `reference/craft.md`): product demo, myth vs fact, checklist, calculation, versus, rules/red flags, local/coverage, FAQ, social proof. Skip published topics.
If the user already said what to make ("make 10 more"), don't wait for approval — pick the strongest and continue.

### 4. Write specs
One file per reel: `specs/NN-slug.json` (numbered to continue the existing sequence). Scene types, fields and markup: **`reference/spec-format.md`** — read it before writing specs. Keep to the brand voice and to facts from `context.md`. Mock UIs only: never real users' names, numbers or photos.

### 5. Preview & iterate
```bash
$REEL preview 07 08 09        # or --all; add --open to open the players in the browser
```
- **QA every storyboard yourself** (Read `out/<id>/storyboard.jpg`): text overflowing or wrapping badly, content under the safe zones (top ~220 px, bottom ~420 px, right ~150 px), taps missing their target, empty/half-faded frames, facts that don't match `context.md`. Fix and re-preview before showing the user.
- Give the user `out/index.html` (gallery of all storyboards, players, captions) and the per-reel `player.html` (Play/scrub, arrow keys frame-step, scene jump, **Safe zones** overlay). They refresh after each `preview`.
- Iterate on feedback by editing the spec, never the generated HTML. Use `$REEL frames <spec> --times 4.2,6` to inspect exact moments.

### 6. Render & deliver
```bash
$REEL render --all                      # silent (user adds a trending sound in the app)
$REEL render 07 --voice Thomas          # macOS TTS from each scene's "vo" (say -v '?' lists voices)
```
Outputs `out/<id>/<id>.mp4` (1080×1920, 30 fps, H.264 + AAC), `cover.jpg`, `caption.txt`. Voiceover warns when a line doesn't fit its scene — shorten the line or raise the scene `dur`. A recorded voice or music bed: set `"audio": "assets/file.mp3"` (or `{ "file", "volume" }`).
Copy the MP4s where the user wants them (ask once; default: leave in `out/`), update "Already published" in `context.md`, and report a table of reels with duration + caption. Flag any fact that is time-sensitive (prices, commissions, dates).

## Rules
- Facts come from `context.md` only; if a reel needs a fact you don't have, find a source or drop the claim.
- Don't use other companies' logos or imitate their branding; naming them in text for comparison is fine unless a "Do not" rule says otherwise.
- Keep workspace files in `.claude/reel-studio/`; don't add files elsewhere in the project.
- The engine lives in the skill (`engine/`, `bin/`). Improve it there when a scene type is missing — or use the `html` scene type for one-offs.
