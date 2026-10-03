# Docs Pipeline and Dev Server (`server/`, outside `server/compiler/`)

Every fact this file once carried now lives in a writable home — this is a pointer, not a reference. Read in this order:

1. **`server/SERVER.md`** — authoritative for all of it: the runtime seam (`server/runtimes/`, no `Bun.*` outside it), file signals, effects (`createBuildEffect()`, the `ready` contract, `writeFileSafe()`), the two `html` tags and the `[object Object]` symptom, template escaping and `raw()`, `guardPath`, HMR conditions, the Markdoc-tag checklist, build outputs (`docs/` and `docs-src/api/` are generated — never hand-edit), and the route table.
2. **`server/TESTS.md`** — test strategy and the source-mirrored file layout under `server/tests/`.
3. **`server/templates/README.md`** — the template system for authors.

If you are about to add a server trap here: put it in `SERVER.md` instead. This file stays a pointer only when every entry it would name has a writable home.
