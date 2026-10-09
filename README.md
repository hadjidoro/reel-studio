# Reel Studio

A collaborative [Claude Code](https://claude.com/claude-code) skill for short vertical promo videos: Facebook and Instagram Reels, TikTok, YouTube Shorts and LinkedIn. It works for any product or website.

**profile (context + links) → campaign (platforms, theme, count) → concepts ✋ → storyboards ✋ → MP4s**

- **Runs only when you call it:** type `/reel-studio`. Claude never starts it on its own.
- **Interviews you first:**
  - your context, in your own words;
  - every useful link: website, social pages, code, docs, competitors, inspiration;
  - which platforms, which theme, series or A/B variants, and how many videos.

  The profile is saved and confirmed at the start of each run.
- **Two approval points:** you approve the concepts, then the storyboards. Nothing renders before both.
- **One master video, every platform:** platform presets supply safe zones, length ranges, caption limits and tone. Preview flags text under any platform's on-screen buttons and captions, lengths out of range, and caption problems. Render writes one caption per platform.
- **Engine:** 17 brand-themed scene types:
  - hooks, numbers, checklists and money calculations
  - chats, versus screens and phone walkthroughs
  - Ken Burns photo slideshows, price/promo reveals and testimonials

  On top of those:
  - word-by-word subtitles synced to the voiceover;
  - kinetic text reveals;
  - push, wipe, zoom and whip transitions.
- **Preview:**
  - a browser player you can scrub, with a safe-zone overlay;
  - a storyboard image per video;
  - a gallery page per campaign.
- **Render:** 1080×1920 30 fps H.264 MP4s, each with a cover image, rendered through [HyperFrames](https://github.com/heygen-com/hyperframes) on parallel workers (`--quality draft` for quick checks). The voiceover can be macOS TTS, your own recording, or a music bed.
- **Nothing is versioned:** the workspace's own `.gitignore` keeps the profile, specs and renders out of git.

## Install

**With the [skills.sh](https://skills.sh/) CLI** (Claude Code, Codex, Cursor, Copilot, Gemini CLI and others):

```bash
npx skills add hadjidoro/reel-studio        # into this project
npx skills add hadjidoro/reel-studio -g     # or globally, for every project
```

**Or with git**, into your agent's skills folder:

```bash
git clone https://github.com/hadjidoro/reel-studio ~/.claude/skills/reel-studio   # or <project>/.claude/skills/reel-studio
```

Then run the doctor once. It checks the requirements and installs `puppeteer-core` into the skill folder:

```bash
<skill folder>/bin/reel doctor              # e.g. ~/.claude/skills/reel-studio/bin/reel doctor
```

Optionally put `reel` on your `PATH` so you can call it from anywhere:

```bash
ln -s <skill folder>/bin/reel ~/.local/bin/reel   # or any directory on your PATH
```

**Requirements:**
- Node 22 or later (HyperFrames, the renderer, needs it)
- ffmpeg
- Google Chrome or Chromium. If it's in an unusual location, set `CHROME_PATH`.
- macOS `say`, only for the voiceover
- The `gh` command-line tool, only for private GitHub repos

## Use

In Claude Code, inside any project, type:

```
/reel-studio
/reel-studio 3 TikToks about our new pricing     # arguments pre-fill the answers
```

You can also run the command-line tool yourself, from anywhere inside the project:

```bash
reel init --link mysite.com --link https://facebook.com/mypage --link . --link competitor=https://tiktok.com/@rival
reel profile                     # summary of the saved profile
reel campaign new "Back to school" --platforms facebook,tiktok,linkedin --mode series --count 3
reel preview --all --open        # player.html + storyboard.jpg per video, plus the campaign gallery, with safe-zone and caption checks
reel frames 03 --times 2,4.5     # exact stills
reel render --all                # MP4 + cover + caption-<platform>.txt (HyperFrames; --engine classic for the old renderer)
reel render 03 --voice Thomas    # with text-to-speech voiceover (and subtitles if the spec enables them)
reel campaign list               # list campaigns; any command takes --campaign NAME, and the newest is the default
```

`bin/reel` is a small bash wrapper around `bin/reel.mjs`. If you skipped the `PATH` step, use `<skill folder>/bin/reel` instead of `reel`. The agent finds the skill folder itself; see [SKILL.md](SKILL.md).

The workspace lives in `<project>/.claude/reel-studio/`, and git ignores all of it:

```
brand.json  context.md  sources.json  assets/  sources/      the profile, reused across runs
campaigns/<date>-<theme>/campaign.json  brief.md  specs/  out/   one folder per run
```

Workspaces from 1.0 are converted automatically. Their links become the new link list, and existing specs move into an `earlier-reels` campaign.

## Docs

- [SKILL.md](SKILL.md): the workflow Claude follows.
- [reference/spec-format.md](reference/spec-format.md): scene types, fields, markup and the brand file.
- [reference/craft.md](reference/craft.md): hooks, pacing, formats and captions.
- [reference/platforms/](reference/platforms/): per-platform presets (safe zones, length, caption limits, tone).
- [reference/motion/](reference/motion/): hooks and retention, typography and subtitles, format recipes, motion principles. Adapted from [iart-ai's MIT-licensed motion skills](https://github.com/iart-ai/motion-skills); see [ATTRIBUTION](reference/motion/ATTRIBUTION.md).
- [templates/example-spec.json](templates/example-spec.json): a starter reel.

## License

[MIT](LICENSE)
