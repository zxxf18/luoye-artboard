# Implementation Plan: 1.10.5 drawing and tool shelf update

## Overview

Improve one-stroke shape recognition so a new gesture can complete a shape that already has compatible segments, release version 1.10.5, repair the About action, replace the unclear collage entry with a child-friendly shape composition workflow, and move secondary creative tools to the second tool page.

## Assumptions

- Existing drawing geometry and layer history remain the source of truth; recognition may replace only the current gesture or merge it with compatible recent geometry.
- “剪贴画” should create reusable colored shape pieces that can be placed, moved, and combined on the main canvas.
- The first tool page should prioritize everyday painting, while pixel art, animation, and collage belong together on the second page.
- Version 1.10.5 is a patch release and does not require a breaking data migration.

## Task List

### Phase 1: Recognition foundation

- [x] Task 1: Add tests and geometry helpers for combining the current stroke with existing line or shape segments.
- [x] Task 2: Integrate combined-shape recognition without changing low-confidence freehand strokes.

### Phase 2: UI and release

- [x] Task 3: Repair About dialog activation and add regression coverage.
- [x] Task 4: Move pixel art, animation, and collage actions to the second tool page.
- [x] Task 5: Bump version to 1.10.5 and update user-facing build metadata.

### Phase 3: Collage redesign

- [x] Task 6: Replace the collage flow with a clear shape-piece editor and accessible placement actions.
- [x] Task 7: Add focused tests for collage state, rendering, and placement behavior.

### Checkpoint: Complete

- [x] Focused tests and full test suite pass.
- [x] Windows build succeeds with version 1.10.5.
- [ ] Working tree is clean after the intended commit.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Combining an old line with a new stroke could alter intentional freehand work | High | Require endpoint proximity, geometric confidence, and a single compatible recent segment; otherwise keep both strokes. |
| Moving feature buttons can break dynamic mounting | Medium | Keep existing button nodes and event handlers; only change their destination/page grouping. |
| Collage changes could invalidate saved projects | Medium | Preserve the existing normalized piece model and layer serialization contract. |

## Verification

- `node --test tests/*.test.js`
- `node tools/build-windows.mjs`
- Inspect the generated v1.10.5 executable and build manifest.
