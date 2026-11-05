# Photo Editor + Catalog (Pi App) — Plan

A local-first web app for cataloging and editing photos, usable on phone and desktop, built to run inside the Pi Browser. Photos never leave the user's device.

## Decisions
- Idea scope: combine "Quick Photo Editor + Export" with "Photo Catalog / Organizer".
- Storage: local-only (no cloud sync for now).
- Pi: sign-in only. No Pi payment hooks for now.
- RAW support: deferred; may be added later via WebAssembly.

## Product scope (v1)
- **Import:** file picker and drag-and-drop (JPEG, PNG, WebP, HEIC if the browser supports it); read EXIF on import.
- **Catalog:** thumbnail grid, albums, tags, star ratings, favorites; search and filter by tag, date, camera.
- **Edit (non-destructive):** exposure, contrast, highlights, shadows, temperature, saturation, sharpness, crop, rotate, straighten, preset filters, reset, undo/redo, before/after.
- **Export:** JPEG, PNG or WebP with quality slider and resize; single photo or batch; download or share sheet.
- **Pi:** sign-in via the Pi SDK, kept in a separate adapter so the app also runs outside Pi.

## Architecture
- **UI:** React + TypeScript + Vite, responsive layout (bottom toolbar on phone, side panels on desktop).
- **Storage:** IndexedDB for catalog metadata; OPFS for original files and thumbnails.
- **Edit engine:** pure module with no UI imports. Edits are stored per photo as JSON; originals are never modified. WebGL2 shader renders a downscaled preview live; full resolution only on export.
- **Workers:** thumbnails, EXIF parsing and export run in Web Workers.
- **Backup:** export/import the catalog as a zip, since browsers can evict stored data.
- **Pi adapter:** isolates Pi SDK calls behind an interface.
- **Hosting:** static site; optional Docker/nginx image later.

## Phases
| Phase | Deliverable |
|---|---|
| 0. Setup (done) | Vite + React + TS project, lint and tests, deployed hello-world, verify it opens in the Pi Browser (WebGL2, OPFS, file picker). |
| 1. Library (done) | Import, thumbnails, EXIF, grid view, persistent catalog. |
| 2. Organize (done) | Albums, tags, ratings, favorites, search and filters. |
| 3. Edit (done) | Photo view, shader pipeline, adjustment sliders, crop/rotate, undo/redo, before/after. |
| 4. Export (done) | Single and batch export, resize and quality options. |
| 4b. UI redesign | Apply the design canvas (see "UI redesign" below): dark theme, sidebar and drawer layout, grid, selection bar, landing, restyled editor and dialogs. |
| 5. Pi integration | Register the app, Pi sign-in, sandbox testing. |
| 6. Polish | Mobile gestures, keyboard shortcuts, catalog backup, performance on large libraries. |
| 7. Later | Presets, Pi payments, background removal, RAW via WebAssembly, cloud sync. |

## UI redesign
Source: the "Photo Editor & Catalog" design canvas (https://claude.ai/artifact/GmN23JdVthu15SQ7WFQKKS). It has two boards: Landing and Dashboard (web and mobile views). We follow its layout, colors and behavior only. The Pi Network design system that the canvas was built on is NOT used: no Pi components, tokens, fonts or icon set.

**Design tokens (the Dashboard board's own palette)**
- Dark theme: background #0F1112, sidebar and cards #1A1D1F, text #F2F4F5, muted text #A9B1B5, borders #2A2F32.
- Teal accent: #2DB7B5 (brand), #7FE3E0 (text on dark), #173B3C (selected row), #12908E (button fill).
- UI library: shadcn/ui (Radix primitives + Tailwind CSS v4), with `lucide-react` icons, `sonner` toasts and `vaul` bottom sheets. Components live in `src/components/ui`; tokens live in `src/theme.css`. Dark only (`class="dark"` on `<html>`).
- Everything the board doesn't specify uses our own choices: system font stack (no font download), 10px radius, simple shadows.
- Button teal in `theme.css` is #0f7a78 (white text 5:1), a little darker than the design's #12908E.
- Contrast: white text on #12908E is about 3.9:1, which passes only for large text. A slightly darker fill (about #0F7A78, 5:1) is needed for 14–16px button labels.

**Landing board:** full-screen hero image with two buttons, "Upload photos" and "Open library". Shown on first run (empty library).

**Dashboard board**
- Left sidebar (320px) listing albums, with a "+" button for a new album and a full-width "Upload photos" button at the bottom.
- Main pane: album name, photo count, and a 4:3 photo grid (minimum 160px columns, 16px gap).
- Tapping a photo selects it (teal ring); a sticky bar then offers "Edit" and "Clear".
- On phones (≤720px) the sidebar becomes a slide-in drawer opened from a menu button.

**Not in the design yet (to extend in the same style):** All photos and Favorites entries, search, filters, sort, tags, ratings, the photo viewer, the editor, the export dialog, and styled confirm and prompt dialogs.

**Build order (push after each step)**
1. Foundation (done, not pushed on its own): Tailwind v4, shadcn/ui components, dark teal tokens. Old screens (App.css) look slightly different until they are rebuilt, so push after step 2.
2. App shell: sidebar and mobile drawer, header, grid, selection bar.
3. Landing and empty state.
4. Restyle the viewer, editor and export dialog.
5. Replace browser prompts and confirms with styled dialogs, and add toasts.
6. Accessibility, contrast and phone/tablet/desktop checks.

## Risks and checks
- **Pi Browser capabilities:** confirm WebGL2, OPFS and file picker work there before Phase 1.
- **Phone memory:** use downscaled previews and tile-based export for large photos.
- **Storage limits:** warn when space runs low; offer catalog backup.
- **Pi docs gaps:** hosting and security-policy details were not found; read the Getting Started and Environments docs at https://developers.minepi.com/docs before Phase 5.

## Next step
Start Phase 0.
