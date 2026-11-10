# Asset tools

- `asset-distribution.mjs`: load the shared current/previous catalogs and select the community or store distribution.
- `runtime-assets.mjs`: collect runtime paths and exclude unreferenced images from distributables.
- `publish-store-art.mjs`: publish local generated masters into category-specific sprite and thumbnail directories.
- `audit-store-art.mjs`: inspect generated sprite sheets for transparent margins, empty cells and distinct animation frames.
- `manifests/`: prompts, expected grouping contracts and generation provenance.

Run publishing and auditing from the repository root:

```sh
node tools/assets/audit-store-art.mjs
node tools/assets/publish-store-art.mjs
```

Publishing requires the original masters under `local-only/store-art/masters/` and Sharp (set `LUOYE_SHARP` if necessary). Normal application builds only need the checked-in runtime assets and catalogs.

Build entrypoints remain in `tools/` so existing npm, Android and CI commands keep their paths. Older one-off art generators remain in their existing locations; this directory owns the current store/community material workflow.
