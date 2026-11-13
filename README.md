# tlpres: a tldraw slideshow with a free camera

Slides are 16:9 frames on one infinite tldraw canvas. Step through them with the arrow keys, or
zoom and pan freely to show how ideas relate. Static site, no backend.

## Link previews (open graph images)

Pasted links become cards that show only the URL, because a browser page can't read other sites' metadata. Before the talk, fill them in from the command line:

```bash
npm run unfurl -- decks/my-talk.tldr           # cards without an image yet
npm run unfurl -- decks/my-talk.tldr --force   # redo every card
npm run unfurl -- decks/my-talk.tldr --remote  # keep image URLs instead of embedding them
```

It reads each link's title, description, `og:image` and favicon, embeds the images in the file (so the deck works offline) and makes the card taller to fit the image. A backup is saved as `<file>.bak` (git-ignored). Then import the file again. Cards on sites with no `og:image` stay as short cards. Needs network access when you run it, not when you present.

## Publish read-only on GitHub Pages

`.github/workflows/pages.yml` (on the `tldraw-v3` branch only) builds a read-only viewer of one deck and publishes it on every push to that branch. The viewer has no toolbar or editing, doesn't use anyone's saved browser copy, and keeps slide navigation, presentation mode (`P`) and toggle boxes. Speaker notes are removed from the published file (`scripts/strip-notes.mjs`).

This branch uses **tldraw 3.15**, which (unlike 4.x and later) runs in production without a license key and shows the "made with tldraw" watermark. Check tldraw's license text for the version you ship. Differences from the 5.x version: no underline formatting, arrow labels are plain text, and `.tldr` files saved by 5.x must be converted first (tldraw only migrates files upward). The workflow does that with `scripts/downgrade-deck.mjs`; to convert by hand: `node scripts/downgrade-deck.mjs in.tldr out.tldr`. Files saved by this version open fine in newer tldraw.

One-time setup in the GitHub repo: Settings > Pages > Build and deployment > Source: **GitHub Actions**. Also allow the `tldraw-v3` branch under Settings > Environments > github-pages > Deployment branches (the default only allows `main`). Then list the decks to publish in `DECKS:` at the top of the workflow (space-separated), push the `tldraw-v3` branch, and open `https://<user>.github.io/<repo>/<deck-name>/` (the file name lower-cased, e.g. `decks/sor-nov-26.tldr` becomes `.../sor-nov-26/`; `.../` itself lists all published decks). To build locally: `node scripts/build-site.mjs decks/my-talk.tldr`, output in `site/`.

To try the viewer locally: `npm run dev` and open `http://localhost:5173/?view`, or `VITE_VIEWER=1 npm run build`.

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
- Order is explicit: **drag rows in the left panel** to reorder. Canvas position does not matter.
- **Return to a slide later:** hover a row and click **↺+** to add another visit at the end of the
  talk, then drag it where you want it. Revisits show a ↺, the slide's canvas label lists all its
  positions ("Slide 2, 5"), and the arrow keys, presenter window and counter follow the sequence.
  Remove a revisit with **×** (a slide's last visit can't be removed). The sequence is saved in
  the `.tldr` file. PDF export has one page per slide, not per visit.
- `\` (or the **‹ Hide** button) hides the left panel; click the **☰ Slides** tab or press `\` again to bring it back. Remembered per browser.
- `N` toggles the notes box for the current slide.
- **Collapsible text box** (`C`, or the `>` tool): shows only its title until you click it. Click the title bar to toggle open/closed, double-click the title to edit it, or the text to edit it with formatting (`Cmd/Ctrl+B` bold, `+I` italic, `+U` underline, plus tldraw's toolbar for lists, links and more; `Esc` to finish), drag moves it. Works in edit mode, and clicking the title bar also toggles it while presenting (editing is blocked there).
- **Image with a toggleable text box**: drop an image on the canvas, right-click it and choose *Make image toggleable*. Click the image to open or close a text box underneath (double-click to edit it, same formatting as above). Also toggles while presenting. Drag the grip along the bottom edge of the open text box to change its height (works while editing); resizing from the corners or sides scales the image and keeps its aspect ratio. Image/PDF export shows the text without formatting.
- Arrows snap to slides: draw an arrow (`A`) from one slide's border to another's to show how ideas connect. Arrows follow when slides move.
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
