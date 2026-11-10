# Asset organization

Runtime artwork lives under `public/assets/` and is grouped by business role: `background`, `sticker`, `fairy`, `animation`, `frame`, `paper`, and `texture`. Each category keeps its runtime sprites and thumbnails together; source masters and vectors use their own subdirectories where needed.

`public/assets/catalog.json` is the source index. `catalog.js` is the browser bundle generated from the same entries. Paths are category-based and do not encode release versions.

Music lives under `public/music/`. The twenty MIDI files are indexed by `tracks.json`; `SOURCES.md` records their provenance.

Current redrawn artwork lives in `public/assets/{background,animation,fairy}/store/{sprites,thumbs}/`. Existing artwork keeps its original paths, so community builds can continue to expose the previous version without duplicating files.

Source-only metadata is separated from public files:

- `resources/assets/legacy-catalog.json`: the 111 previous entries, merged only into community builds.
- `tools/assets/manifests/`: redraw prompts and provenance records.
- `tools/assets/`: publishing, auditing, catalog selection and packaging helpers.
- `local-only/store-art/masters/`: local generation masters, excluded from Git and distributables.

`tools/assets/asset-distribution.mjs` is the shared catalog loader for builds and the development server. Store builds contain 1582 current entries; community builds contain 1693 entries including the 111 previous entries. Neither build ships the source archive index. Docker explicitly uses the store distribution.
