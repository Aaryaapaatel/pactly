# Pactly reel

15-second 9:16 (1080x1920) promo reel. `pactly-reel.mp4` is the finished cut.

Everything is code, so copy, colours, and timing can be edited and re-rendered:

- `index.html`: the animation. `render(t)` draws the frame at time `t` seconds; each scene is a function (`s1`…`s10`). Every cut sits on a 120 BPM grid (one beat = 0.5s).
- `music.js`: synthesizes the soundtrack (`music.wav`) on the same grid.
- `render.js`: renders 900 frames at 60fps with Playwright, blends them down to 30fps for motion blur, and muxes the audio into `pactly-reel.mp4`.
- `stills.js`: renders single frames for checking, e.g. `node stills.js 0.5 5.2 14.9` (writes to `st/`, which must exist).
- `fonts/`: Anton, Inter Tight, JetBrains Mono (SIL Open Font License, from Google Fonts).

```bash
cd marketing/reel
npm install
npm run render   # needs Playwright + Chromium; render.js expects a global Playwright install
```

The render is roughly 90 Mbps because of the film grain; re-encode with
`-crf 21 -maxrate 12M -bufsize 24M` for a postable file (~23 MB).
