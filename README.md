# Reel Studio

A [Claude Code](https://claude.com/claude-code) skill that plans, previews and renders short vertical promo videos (Facebook/Instagram Reels, TikTok, YouTube Shorts) for any product or website.

**context → scripts → JSON specs → preview & storyboard → iterate → MP4**

- **Onboarding:** asks for your Facebook page, website, and where the source code is (this project, a local folder, or a GitHub URL). It then builds a sourced fact base and brand file from them.
- **Scripts:** proposes reel ideas with hooks, scene beats and captions, and skips topics you've already published.
- **Specs:** each reel is a small JSON file. There are 13 scene types, from hooks and checklists to money calculations, chats, versus screens and phone-app walkthroughs, all themed with your brand colors, font and logo.
- **Preview:**
  - A browser player lets you play, scrub, step frame by frame, jump between scenes and show a safe-zone overlay.
  - A storyboard image shows every scene at a glance.
  - A gallery page lists all reels with their captions.
- **Render:** produces 1080×1920 30 fps H.264 MP4s, each with a cover and a caption file. A macOS text-to-speech voiceover, your own recorded voice or a music bed are optional.

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
- Node 18 or later
- ffmpeg
- Google Chrome or Chromium. If it's in an unusual location, set `CHROME_PATH`.
- macOS `say`, only for the voiceover
- The `gh` command-line tool, only for private GitHub repos

## Use

In Claude Code (or any agent that loads the skill), inside any project, ask for something like *"make 6 reels for our Facebook page"*. The skill runs onboarding, gathers context, proposes scripts, previews them, and renders once you're happy.

You can also run the command-line tool yourself, from anywhere inside the project:

```bash
reel init --facebook https://facebook.com/mypage --website mysite.com --code .   # or a path, a GitHub URL, or none
reel sources [sync]              # show sources, or pull the latest GitHub source
reel preview --all --open        # player.html + storyboard.jpg per spec, plus out/index.html
reel frames 03 --times 2,4.5     # exact stills
reel render --all                # MP4 + cover + caption
reel render 03 --voice Thomas    # with text-to-speech voiceover from each scene's "vo"
```

`bin/reel` is a small bash wrapper around `bin/reel.mjs`. If you skipped the `PATH` step, use `<skill folder>/bin/reel` instead of `reel`. The agent finds the skill folder itself; see [SKILL.md](SKILL.md).

The workspace lives in `<project>/.claude/reel-studio/`. It holds `sources.json`, `brand.json`, `context.md`, `specs/` and `assets/`. The `sources/` and `out/` folders are git-ignored.

## Docs

- [SKILL.md](SKILL.md): the workflow Claude follows.
- [reference/spec-format.md](reference/spec-format.md): scene types, fields, markup and the brand file.
- [reference/craft.md](reference/craft.md): hooks, pacing, formats and captions.
- [templates/example-spec.json](templates/example-spec.json): a starter reel.

## License

[MIT](LICENSE)
