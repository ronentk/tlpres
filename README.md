# tlpres: a tldraw slideshow with a free camera

Slides are 16:9 frames on one infinite tldraw canvas. Step through them with the arrow keys, or
zoom and pan freely to show how ideas relate. Static site, no backend.

## Branches

- **`main`**: the editor, on tldraw 5.x. Production use of tldraw 4.x and later needs a license key.
- **`tldraw-v3`** (this branch): the same app ported to tldraw 3.15, which runs in production
  without a key (with the "made with tldraw" watermark). Pushing this branch publishes the
  read-only viewer to GitHub Pages. See [Publishing](#publishing-read-only-on-github-pages).

Differences from `main`: no underline formatting, arrow labels are plain text, and `.tldr` files
saved by tldraw 5.x must be converted before this version can open them (tldraw only migrates files
upward; use `scripts/downgrade-deck.mjs`, below). Files saved here open fine in newer tldraw.

## Link previews (open graph images)

Pasted links become cards that show only the URL, because a browser page can't read other sites' metadata. Before the talk, fill them in from the command line:

```bash
npm run unfurl -- decks/my-talk.tldr           # cards without an image yet
npm run unfurl -- decks/my-talk.tldr --force   # redo every card
npm run unfurl -- decks/my-talk.tldr --remote  # keep image URLs instead of embedding them
```

It reads each link's title, description, `og:image` and favicon, embeds the images in the file (so the deck works offline) and makes the card taller to fit the image. A backup is saved as `<file>.bak` (git-ignored). Then import the file again. Cards on sites with no `og:image` stay as short cards. Needs network access when you run it, not when you present.

## Publishing read-only on GitHub Pages

Live at `https://ronentk.me/tlpres/<deck-name>/` (the repo's Pages site inherits the custom domain of
`ronentk.github.io`). `https://ronentk.me/tlpres/` lists every published deck.

`.github/workflows/pages.yml` runs on every push to the **`tldraw-v3`** branch. It:

1. takes each file in `DECKS:` at the top of the workflow (space-separated, default
   `decks/sor-nov-26.tldr`),
2. converts it to the tldraw 3.x file format (`scripts/downgrade-deck.mjs`) and blanks the speaker
   notes (`scripts/strip-notes.mjs`), because the `.tldr` is downloadable from the site,
3. builds one read-only viewer per deck into `site/<name>/` (`scripts/build-site.mjs`), where
   `<name>` is the file name lower-cased with other characters turned into `-`
   (`decks/sor-nov-26.tldr` becomes `/sor-nov-26/`), plus an index page,
4. deploys `site/` to Pages.

To publish another deck, add its path to `DECKS:` and push. No license key or secret is needed.

**Viewer mode** (`VITE_VIEWER=1` at build time, or `?view` on any URL): the canvas is read-only,
there is no toolbar or editing UI, no saved browser copy is used (it always loads the shipped
deck), and the slide list, arrow-key navigation, presentation mode (`P`), and the collapsible /
image-note boxes (click to toggle) still work. The watermark stays.

**One-time setup** in the GitHub repo:
- Settings > Pages > Build and deployment > Source: **GitHub Actions**.
- Settings > Environments > github-pages > Deployment branches: allow `tldraw-v3` (the default
  only allows `main`).

**Try it locally**
```bash
npm run dev                       # then open http://localhost:5173/?view
node scripts/build-site.mjs decks/sor-nov-26.tldr   # builds site/ (needs no key)
npx vite preview --outDir site/sor-nov-26            # serve one built deck
```

**Convert a deck by hand:** `node scripts/downgrade-deck.mjs in.tldr out.tldr`. Lossy: underline
marks are dropped, arrow label formatting becomes plain text, and shape flips on geo shapes are
dropped. Your original file is not touched.

**Notes**
- A deck with embedded images is large (the current one is about 25 MB), so the first load can be
  slow on mobile.
- The published site is public, including the deck file and all embedded images.
- Keep the deck up to date by merging your changes from `main` (or copying the `.tldr`) into
  `tldraw-v3` and pushing. App code changes can conflict because of the 3.x port.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Type-check: `npx tsc --noEmit -p tsconfig.app.json`.

## License key

This branch (tldraw 3.15) needs **no license key**, locally or in production. Check tldraw's license
text for the version you ship. (On `main`, tldraw 5.x needs a key for production use:
`cp .env.example .env.local` and set `VITE_TLDRAW_LICENSE_KEY`; keys are tied to specific domains and
are visible in the built JavaScript.) Never commit `.env.local`; it is git-ignored. The "made with
tldraw" watermark is always left visible, including in presentation mode.

## Build and run offline

```bash
npm run build && npm run preview
```

Fonts, icons and translations are bundled from `@tldraw/assets` (no CDN). Verified with all
non-localhost requests blocked.

## Authoring

- `S` draws a slide (or use the toolbar). Move and resize them like any shape (they stay 16:9).
- Put text, images, arrows etc. on top of a slide. Anything inside a slide's frame belongs to it.
- Order is explicit: **drag rows in the left panel** to reorder. Canvas position does not matter.
- **Return to a slide later:** hover a row and click **↺+** to add another visit at the end of the
  talk, then drag it where you want it. Revisits show a ↺, the slide's canvas label lists all its
  positions ("Slide 2, 5"), and the arrow keys, presenter window and counter follow the sequence.
  Remove a revisit with **×** (a slide's last visit can't be removed). The sequence is saved in
  the `.tldr` file. PDF export has one page per slide, not per visit.
- `\` (or the **‹ Hide** button) hides the left panel; click the **☰ Slides** tab or press `\` again to bring it back. Remembered per browser.
- `N` toggles the notes box for the current slide.
- **Collapsible text box** (`C`, or the `>` tool): shows only its title until you click it. Click the title bar to toggle open/closed, double-click the title to edit it, or the text to edit it with formatting (`Cmd/Ctrl+B` bold, `+I` italic, plus tldraw's toolbar for lists, links and more; `Esc` to finish; underline only exists on `main`), drag moves it. Works in edit mode, and clicking the title bar also toggles it while presenting (editing is blocked there).
- **Image with a toggleable text box**: drop an image on the canvas, right-click it and choose *Make image toggleable*. Click the image to open or close a text box underneath (double-click to edit it, same formatting as above).. Also toggles while presenting. Drag the grip along the bottom edge of the open text box to change its height (works while editing); resizing from the corners or sides scales the image and keeps its aspect ratio. Image/PDF export shows the text without formatting.
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

## Using the editor on a host of your own

`npm run build` produces the editable app as a static site in `dist/` (relative paths, so it works
from any folder). Edits live in each browser's storage, not at the URL. To make a fresh browser
show a deck, **Export .tldr**, convert it with `scripts/downgrade-deck.mjs` if it came from tldraw
5.x, save it as `public/deck.tldr`, and rebuild. A browser that already has a saved deck keeps its
own copy: use **Import…** with the file (or clear that site's data) to pick up the new one.
For a read-only public copy, use the Pages workflow above instead.

## Files

`src/App.tsx` (Tldraw setup, viewer mode, assets) · `viewer.ts` (viewer-mode flag) ·
`SlideShapeUtil.tsx` / `SlideShapeTool.ts` (slide shape and tool) · `CollapsibleShapeUtil.tsx` /
`CollapsibleShapeTool.ts` (collapsible text box) · `ImageNoteShapeUtil.tsx` (image with a toggleable
text box) · `toggle.ts` (toggle boxes while read-only) · `SlidesPanel.tsx` (side panel) ·
`presentation.ts` (order, camera, presentation mode, keys, timer) · `PresenterView.tsx` +
`presenterProtocol.ts` (notes window) · `fileio.ts` (.tldr / PDF) · `starterDeck.ts`.

`scripts/`: `unfurl.mjs` (link previews) · `downgrade-deck.mjs` (5.x deck to 3.x format) ·
`strip-notes.mjs` (blank speaker notes) · `build-site.mjs` (per-deck viewers + index).
`.github/workflows/pages.yml`: the publishing workflow. `decks/`: source `.tldr` files.
