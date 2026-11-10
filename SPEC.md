# Spec: tldraw slideshow for "From Users to Sense-Makers" (Seeds of Renaissance seminar)

## Goal
Build a small web app that presents a 35–45 minute talk as a tldraw canvas with a **free camera**. Slides are frames laid out spatially on one infinite canvas, and I move between them with the arrow keys. I can also zoom and pan freely mid-talk to show how ideas relate. My outline is already a spatial canvas (a branching concept map with embedded images, tweets and quotes), so the deck should feel like walking through that map, not like a linear PowerPoint.

Talk topic: the role of tools-for-thought (Obsidian, Semble on AT Protocol) in scaffolding inner development, in the context of Developmental Spaces.

## Base
Start from the official tldraw example **"Slideshow"** (https://tldraw.dev/examples/slides). Its source is in the tldraw repo under `apps/examples/src/examples/slideshow`. Read it first and adapt it, don't rewrite from scratch.

Its key pieces:
- A custom `SlideShapeUtil` (`slide` shape) and `SlideShapeTool` (shortcut `S`).
- A `SlidesPanel` replacing the `HelperButtons` slot.
- `overrides.actions` for `next-slide` / `previous-slide` bound to the right and left arrow keys.
- `editor.zoomToBounds` with animation to move the camera between slides.
- `persistenceKey` for local persistence.

## Stack
- Vite + React + TypeScript, `npm i tldraw`.
- No backend. Static site.

## License (important)
I have a **tldraw hobby license key**.
- Read it from `VITE_TLDRAW_LICENSE_KEY` in `.env.local` and pass it as the `licenseKey` prop on `<Tldraw />`.
- Add `.env.local` to `.gitignore`. Provide `.env.example` with an empty placeholder. Never hardcode or commit the key.
- Do not hide, remove or interfere with the "made with tldraw" watermark. The hobby license requires it to stay visible.
- The license is only required for production builds on a non-localhost domain. Local dev needs no key.

## Requirements

### Must have
1. **Slides as frames:** 16:9 slide shapes (e.g. 1280×720) that I can create, move and resize on the canvas. Keep the example's slide tool.
2. **Presentation navigation:** left/right arrows (also Page Up/Down and a clicker's keys) move to the previous/next slide in order, with an animated camera transition (about 400–600 ms, easing).
3. **Slide order:** the order is explicit. Reorder slides in the side panel by drag, or by a numeric index stored in the slide shape's props. Don't infer the order from canvas position alone, because my layout is a branching map.
4. **Presentation mode** (toggle with `P`): hides toolbar, panels and the slide list. The camera locks to the current slide and fills the viewport with letterboxing. Esc exits. In presentation mode I can still press a key (e.g. `Z`) to **zoom out to the whole canvas** and back, for the "show the big map" moments.
5. **Free camera in edit mode:** pan and zoom normally.
6. **Persistence:** keep `persistenceKey` for the browser, and add **Export / Import** of the whole document as a `.tldr` file via the tldraw APIs. Local storage alone is too fragile for a talk.
7. **Offline-safe:** once built, the deck must work with no network (bundle fonts and assets; check tldraw's asset URL options). Venue Wi-Fi can't be trusted.

### Should have
- **Speaker notes:** a `notes` prop on each slide shape, shown in a separate window or panel (`N`) that is not visible in the projected view. If a second window is too complex, a collapsible panel is fine.
- **Slide counter and elapsed timer:** small and unobtrusive, visible only outside presentation mode or in the notes panel. Optional target duration setting (default 40 min).
- **Fixed-camera variant:** a setting to lock the camera to the slide and disable pan/zoom, as in tldraw's "Slideshow (fixed camera)" example.
- **PDF export** of slides in order (one page per slide), for backup and sharing. Use tldraw's export-as-image API per slide frame and assemble the pages.

### Nice to have
- A starter deck pre-populated with placeholder slides matching my outline sections (see below) so I can begin filling in content.

## Starter structure (placeholder slides, rename freely)
Laid out left to right on the canvas, following my outline:
1. Title: "From Users to Sense-Makers: Tools-for-Thought and Inner Development"
2. The problem: external power vs inner development (Developmental Spaces white paper)
3. "Change minds by changing the world": physical and social environments
4. Epistemic environments: "ask not what's inside your head but what your head's inside of"
5. What is our head currently inside of? (social media / attention environments)
6. What could our head be inside of? (tools-for-thought, note-taking, Obsidian)
7. Semble: a social tool-for-thought on AT Protocol (early findings)
8. Field-building and funding
9. Closing and questions

## Non-goals
- No multiplayer or sync, no accounts, no hosting setup beyond a static build.
- No custom backend and no analytics.

## Acceptance criteria
- `npm run dev` runs the app and the watermark is visible when the license key is set.
- I can create 3 slides, put text and images on them, and step through them with the arrow keys with smooth transitions.
- `P` enters a clean presentation view. `Z` zooms out to the full canvas and back.
- Export then Import round-trips the deck with no loss.
- `npm run build && npm run preview` works with the network disabled.
- No secrets are committed.

## Process notes for Claude Code
- Read the tldraw example source and tldraw's docs (https://tldraw.dev) before writing code. Check the installed `tldraw` version's APIs rather than guessing, since the SDK changes between releases.
- Work in small steps. After each, run the dev server and the type-check (`tsc --noEmit`), and fix errors before moving on.
- Keep the code in a few clear files (`App.tsx`, `SlideShapeUtil.tsx`, `SlideShapeTool.ts`, `SlidesPanel.tsx`, `presentation.ts`) with short comments on anything tldraw-specific.
- Finish with a short README: how to run, how to set the license key, how to present, and how to export a backup.
