# tlpres: a tldraw slideshow with a free camera

Slides are 16:9 frames on one infinite tldraw canvas. Step through them with the arrow keys, or
zoom and pan freely to show how ideas relate. Static site, no backend.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Type-check: `npx tsc --noEmit -p tsconfig.app.json`.

## License key

Local dev needs no key. A production build served from a non-localhost domain needs your tldraw
license key:

```bash
cp .env.example .env.local
# edit .env.local:  VITE_TLDRAW_LICENSE_KEY=your-key
```

`.env.local` is git-ignored; never commit it. The "made with tldraw" watermark stays visible.
Note: Vite inlines the key at build time, so rebuild after changing it.

## Build and run offline

```bash
npm run build && npm run preview
```

Fonts, icons and translations are bundled from `@tldraw/assets` (no CDN). Verified with all
non-localhost requests blocked.

## Authoring

- `S` draws a slide (or use the toolbar). Move and resize them like any shape (aspect ratio is locked).
- Put text, images, arrows etc. on top of a slide. Anything inside a slide's frame belongs to it.
- Order is explicit: **drag rows in the left panel** to reorder (stored in each slide's `index`).
  Canvas position does not matter.
- `N` toggles the notes box for the current slide.
- Double-click a slide's edge, or click its row in the panel, to fly to it.

## Presenting

| Key | Action |
|---|---|
| `P` | Toggle presentation mode (hides all UI, locks the camera, letterboxes the slide) |
| `Esc` | Exit presentation |
| `→` `PageDown` (`↓` `Space` `Enter` while presenting) | Next slide |
| `←` `PageUp` (`↑` `Backspace` while presenting) | Previous slide |
| `Home` / `End` | First / last slide (presenting) |
| `Z` | Zoom out to the whole canvas and back (presenting) |
| `N` | While presenting: open the speaker-notes window (put it on your laptop screen, not the projector) |

In edit mode the arrows navigate only when nothing is selected (otherwise they nudge the selection).
`N` (or Panel > Notes > "Open notes window") opens a **presenter window**; put it on your laptop
screen and the deck window on the projector. They sync in the same browser profile (allow pop-ups).
It has: prev/next, jump-to-slide list, whole-canvas toggle (`Z`), timer start/pause/reset,
thumbnails of the current and next slide (↻ re-renders them), the slide counter and timer, and
editable speaker notes (saved to the deck).

Panel > "Timer, camera, files": timer start/pause/reset, target duration (default 40 min),
and **Fixed camera** (no pan/zoom, no `Z` overview).

## Backups

Panel > "Timer, camera, files":

- **Export .tldr**: the whole document (slides, order, notes, images). Do this before every talk.
- **Import…**: replaces the current deck with a `.tldr` file.
- **Export PDF**: one page per slide, in order.

The browser also autosaves to local storage (`persistenceKey="tlpres-deck"`), but treat that as fragile.

## Deploying to a stable URL

`npm run build` produces a static site in `dist/` (Cloudflare Pages, Netlify, Vercel, GitHub Pages...).
Set `VITE_TLDRAW_LICENSE_KEY` in the host's build environment, and make sure the domain is allowed
for your tldraw key. On a subpath host (GitHub Pages), set `base` in `vite.config.ts`.

Edits live in each browser's storage, not at the URL. To publish a deck so any fresh browser
shows it:

1. Edit locally, then **Export .tldr**.
2. Save the file as `public/deck.tldr`, commit, redeploy.

On load, a browser with no saved deck fetches `deck.tldr` (falling back to the starter deck if
absent). A browser that already has a saved deck keeps its own copy, so to pick up a new
published deck there, use **Import…** with the file (or clear that site's data).

## Files

`src/App.tsx` (Tldraw setup, license, assets) · `SlideShapeUtil.tsx` / `SlideShapeTool.ts` (slide shape and tool)
· `SlidesPanel.tsx` (side panel) · `presentation.ts` (order, camera, presentation mode, keys, timer)
· `PresenterView.tsx` + `presenterProtocol.ts` (notes window) · `fileio.ts` (.tldr / PDF) · `starterDeck.ts`.
