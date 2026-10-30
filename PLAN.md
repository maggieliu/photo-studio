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
| 5. Pi integration | Register the app, Pi sign-in, sandbox testing. |
| 6. Polish | Mobile gestures, keyboard shortcuts, catalog backup, performance on large libraries. |
| 7. Later | Presets, Pi payments, background removal, RAW via WebAssembly, cloud sync. |

## Risks and checks
- **Pi Browser capabilities:** confirm WebGL2, OPFS and file picker work there before Phase 1.
- **Phone memory:** use downscaled previews and tile-based export for large photos.
- **Storage limits:** warn when space runs low; offer catalog backup.
- **Pi docs gaps:** hosting and security-policy details were not found; read the Getting Started and Environments docs at https://developers.minepi.com/docs before Phase 5.

## Next step
Start Phase 0.
