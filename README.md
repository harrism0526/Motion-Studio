# Motion Studio · Lighter Living

Motion graphics written as code. Each video is one HTML file; a headless browser
steps through time frame by frame and ffmpeg turns the frames into an MP4.

## Layout

```
videos/      one .html file per video
brand.css    colours + fonts (every video links it)
lib/motion.js  tiny helpers: tween, easing, seeded random
render.mjs   the renderer
out/         rendered MP4s and stills (git-ignored)
```

## A video is just three things

```js
window.DURATION = 3;              // seconds
window.SIZE = [1080, 1920];       // width, height (TikTok vertical)
window.render = (t) => { ... };   // draw the exact frame at time t
```

Rule: **no CSS animations, transitions, timers or Math.random()**. Everything comes from `t`,
so every render is identical. Use `M.seeded(42)` if you want randomness you can repeat.

## TikTok safe zone

TikTok covers the top, bottom and right edge with its UI. Keep text inside the
`--safe-*` margins in `brand.css` and check with `--guides`. Background art can run full-bleed.

## Render

```bash
node render.mjs hello --stills 3   # 3 quick check images -> out/hello-still-*.png
node render.mjs hello              # full MP4 at 30fps   -> out/hello.mp4
node render.mjs hello --stills 3 --guides  # shade where TikTok's UI covers the video
node render.mjs hello --fps 60     # different frame rate
```

Needs Node 18+, Playwright with Chromium, and ffmpeg.
