# Asset organization

Runtime artwork lives under `public/assets/` and is grouped by business role: `background`, `sticker`, `fairy`, `animation`, `frame`, `paper`, and `texture`. Each category keeps its runtime sprites and thumbnails together; source masters and vectors use their own subdirectories where needed.

`public/assets/catalog.json` is the source index. `catalog.js` is the browser bundle generated from the same entries. Paths are category-based and do not encode release versions.

Music lives under `public/music/`. The twenty MIDI files are indexed by `tracks.json`; `SOURCES.md` records their provenance.
