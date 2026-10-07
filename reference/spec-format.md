# Reel spec format

A spec is a JSON file in `specs/`. The canvas is 1080×1920. Scenes play back to back and cross-fade over 0.3 s. The first scene has no fade-in, so frame 0 works as the thumbnail. An `end` card, built from brand.json, is appended unless the spec sets `"end": false`.

```json
{
  "id": "optional, defaults to the file name",
  "title": "Internal title shown in the gallery",
  "audience": "who it targets",
  "platforms": ["facebook", "tiktok"],
  "captions": { "facebook": "Caption + hashtags", "tiktok": "…" },
  "caption": "fallback caption for any platform missing from captions",
  "voice": "optional default TTS voice, e.g. Thomas",
  "voiceRate": 185,
  "audio": "assets/music.mp3 | { \"file\": \"…\", \"volume\": 0.2 }",
  "end": { "line": "override end-card line", "tagline": "…", "vo": "…" },
  "subtitles": true,
  "subtitleWords": 3,
  "reveal": "words",
  "transition": "fade",
  "watermark": true,
  "css": ".extra{…}",
  "scenes": [ { "type": "hook", "…": "…" } ]
}
```

## Platforms and captions
- `platforms` defaults to the campaign's platforms. The ids are `facebook`, `instagram`, `tiktok`, `youtube-shorts` and `linkedin`. Each preset in `reference/platforms/<id>.json` holds that platform's safe zones, length range, caption limits, hashtag range and tone notes.
- `captions` holds one caption per platform. Render writes each to `caption-<id>.txt`. `caption` is the fallback, which keeps older specs working.
- `preview` checks every storyboard frame against the **union** of the platforms' UI zones. It also checks the length against each platform's sweet spot and limit, and each caption's first line, total length and hashtag count. Fix every ⚠ before showing the user.

## Subtitles, reveals and transitions
- **`subtitles: true`** burns word-by-word subtitles from the `vo` lines.
  - Defaults to brand.json `subtitles`.
  - Each chunk holds up to `subtitleWords` words (default 3). A new chunk starts at punctuation or after 1.2 s.
  - Each word pops in, and the active word takes the accent color.
  - The subtitles sit just above the platforms' caption zone.
  - In the player and storyboard, timing is estimated from the speech rate. `render` uses the real voiceover timings.
  - Keep scene text clear of the subtitle band (about y 1250–1440).
- **`reveal`** is set on a scene or for the whole spec. It changes how headlines (`.h1`, `.h2`) enter:
  - `up` is the default slide-up.
  - `words` and `chars` reveal one word or one letter at a time. The whole group finishes within about 0.8 s.
  - `pop` pops each word in.
  - `mask` makes the line rise out of a clipping edge.

  Use one reveal style per video.
- **`transition`** is how a scene enters. Set it on a scene or for the whole spec. The values are:
  - `fade` (0.3 s, the default)
  - `cut`
  - `push` (0.45 s, the new scene pushes the old one up)
  - `wipe` (0.5 s, left to right)
  - `zoom` (0.5 s, zoom-through)
  - `whip` (0.3 s, fast horizontal move with motion blur)

  `{ "type": "push", "dur": 0.4 }` sets a custom duration. Keep to one transition family per video. Cuts and pushes suit fast videos; fades suit calm ones.

## Common scene fields
| Field | Meaning |
|---|---|
| `type` | one of the types below |
| `dur` | seconds. It's automatic when omitted: the type's reveal time plus reading time. Set it explicitly to pace the reel |
| `vo` | voiceover text read at scene start, or `[{ "at": 1.2, "text": "…", "rate": 200 }]` for lines timed within the scene |
| `bg` | background image under `assets/`, with `bgPos` (e.g. `"20%"`) and `bgFull: true` to cover the whole frame instead of the top 1250 px |
| `top` | y position in px of the scene's text block, when the default doesn't suit |

## Text markup (every text field)
- `**accent**` shows in the brand accent color.
- `!!alert!!` shows in the second accent, for losses and warnings.
- `++success++` shows in green.
- Raw HTML is allowed, for example `<br>`, `<b>` and `&nbsp;`. Put `&nbsp;` before `?` and `!` in French.

Tone values for facts, rows and totals are `accent`, `alert` or `bad`, and `good` or `success`.

## Scene types
| Type | Fields | Use for |
|---|---|---|
| `hook` | `kicker`, `title`, `sub`, `subSize` (`h2` or `p`), `bg` | Opening question or promise. Keep the title to 8 words or fewer |
| `number` | `kicker`, `value` (number), `prefix`, `suffix`, `from`, `title`, `sub` | Opening on a big number that counts up |
| `statement` | `lines[]` (colored white, accent, alert in turn; `plain: true` keeps them white), `sub`, `center`, `step` | Punchlines and short rhythmic lines |
| `list` | `title`, `items[]` (each `"text"` or `["label","sub"]`), `mark` (`ok` ✓, `no` ✕, `num` 1-2-3), `step` | Checklists, red flags, steps. Up to 6 items |
| `facts` | `kicker`, `title`, `facts[]` (each `[value, label, tone]`), `foot`, `step` | 1–3 stat cards |
| `calc` | `title`, `rows[]` (each `[label, value, tone]`), `total` (`[label, value, tone]`), `totalCount` (`{from,to,suffix}`), `foot`, `note` | Money calculations. `note` is for the source line |
| `chat` | `title`, `messages[]` (each `{text, time, me}`) | Messaging-app style conversations showing the outcome |
| `chips` | `title`, `chips[]`, `icon`, `foot`, `step` | Coverage such as cities, categories or features |
| `versus` | `a` and `b` (each `{name, bg, color}`), `question` | Comparison opener |
| `rule` | `n`, `title`, `sub` | One numbered rule per scene |
| `cta` | `title`, `pill` (defaults to brand.url), `sub` | Call to action before the end card |
| `end` | `line`, `tagline` | Logo, slogan and URL. Added automatically |
| `phone` | `steps[]` (each `{caption, screen, dur, taps, style, pad}`) | Product walkthrough in a phone mockup |
| `photos` | `photos[]` (each `"assets/x.jpg"` or `{src, caption, dur, zoom: in\|out, pan: left\|right\|none, pos}`), `each` (default 3 s per photo), `title`, `capTop` | Slideshow of full-frame photos with a slow Ken Burns move, cross-fading. Zoom and pan alternate when omitted. Use at least 2.5 s per photo |
| `promo` | `kicker`, `title`, `was`, `now` (numbers), `prefix`, `suffix`, `decimals`, `badge`, `code`, `codeLabel`, `until`, `countdown` (seconds or `"HH:MM:SS"`) | Price reveal: the old price is struck through and the new price counts down to its value, then the badge, the promo code (typed) and an optional live countdown. Take the prices and deadline from `context.md`, and compute the discount; never type it by hand |
| `testimonial` | `quote`, `author`, `role`, `source`, `stars` (real score, e.g. 4.5; omit when there is none), `avatar`, `reveal` (default `words`) | A real, confirmed public review. The quote reveals word by word, then the stars fill to the score, then the author |
| `html` | `html` | Escape hatch: any markup using the animation attributes below |

## Phone screens
`screen` is HTML rendered inside a 604×1164 phone screen. Its times (`data-t`, `data-o`) are relative to the step. Available classes:
- **Header and text:** `m-top`, `m-logo` (put the second word in `<b>`), `m-title`, `m-badge`, `m-q`, `m-text`
- **Choice cards:** `opt`, containing `.ic`, `.t1` and `.t2`. Animate with `data-a="on"` to select one at `data-t`
- **Form fields:** `fld`, containing a `<label>` and a `.inp`. Use `data-a="type" data-d="1"` on `.inp` to type its text
- **Buttons:** `btn`, with color variants `g` (green), `k` (dark) and `o` (outline)
- **Filter chips:** `chips` containing `chip` elements, with `.on` for the selected one
- **Listing cards:** `card` containing an `img` and `.cb`, which holds `.ck` (kicker), `.ct` (title), `.cl` (location) and `.cp` (price, as `<b>` plus `<span>`)

`taps` is a list of `[x, y, at]` in canvas px. The phone screen spans x 238–842 and y 438–1602. Check tap positions against the storyboard.

## Animation attributes (for `html` scenes and phone screens)
Set `data-a` to choose the animation:
- `up` slides up, `left` slides in from the left, and `fade` fades in
- `pop` scales in with a bounce
- `on` adds the class `.on` at `data-t`
- `type` types out the element's text
- `count` counts up, using `data-from`, `data-to`, `data-suf` and `data-pre`
- `tap` shows a tap ripple
- `grow` scales in horizontally
- `kb` slowly zooms, Ken Burns style
- `words`, `chars` and `mask` are the kinetic reveals described above
- `ken` is the photo move, using `data-z` (`in` or `out`) and `data-p` (`left`, `right` or `none`)
- `clock` counts down live from `data-from` seconds

Timing attributes:
- `data-t` is the start time within the scene
- `data-d` is the duration, 0.55 s by default
- `data-o` fades the element out at that time

Double quotes inside JSON strings need escaping, so use single quotes for HTML attributes.

## brand.json
Fields:
- `name`
- `wordmark` as `["AC","ME"]`, where the second part is shown in the accent color. Alternatively `logo` and `logoSmall` image paths
- `url`
- `endLine`
- `tagline`
- `lang`
- `font` as `{ family, google?, files?: [{file, weight}] }`
- `colors`:
  - `bg`, `bg2`, `text`, `muted`
  - `accent`, `accent2`, `success`, `onAccent`
  - `surface` and `ink`, used for phone screens
- `numberGroup`, the thousands separator used by count-ups
- `decimalSep`, the decimal separator used by prices
- `voice`, the default macOS voice for voiceover; `null` means silent
- `subtitles` and `subtitleWords`, the defaults for burned-in subtitles
- `watermark`, false to hide it
- `css`, extra global styles
