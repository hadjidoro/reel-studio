# Notice

Parts of the motion and design in `engine/engine.js` and `engine/engine.css` are adapted from HyperFrames catalog components by HeyGen:

- Source: https://github.com/heygen-com/hyperframes
- License: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
- Copyright 2026 HeyGen, Inc.

Components adapted:

| HyperFrames component | Used for in Reel Studio |
|---|---|
| mesh-gradient-bg | `background: "mesh"` |
| grain-overlay | `grain` |
| headline-slam | `reveal: "slam"` |
| char-slam-explode | `reveal: "explode"` |
| cta-close | bold `cta` scene (word landing, button pop, glow) |
| caption-pill-karaoke | `subtitleStyle: "pill"` |
| count-up | bold `promo` price (count, glow, landing pulse) |
| spring-pop | bold `promo` badge |
| testimonial-proof-card | `testimonial` with `card: "proof"` |
| star-rating-fill | star row and score of the proof card |
| logo-brand-close | `endStyle: "brand"` |
| whip-pan-cut | `whip` transition |
| zoom-through-transition | `zoom` transition |
| chromatic-aberration-wipe | `chroma` transition |

The push and blur transitions and the photo `stories` layout follow the HyperFrames trial composition built from these components.

## Changes

The code was modified. The GSAP timelines of the components were translated into Reel Studio's seek-driven engine: every value is computed by `window.render(t)` from the time alone. The engine uses small GSAP-equivalent easing functions and a seeded random generator in place of GSAP, CSS animations and runtime randomness. Sizes, colours and timings were adapted to the 1080×1920 canvas and the brand variables. No HyperFrames or GSAP code is loaded at runtime.

Each adapted section in `engine/engine.js` names its source component in a comment.
