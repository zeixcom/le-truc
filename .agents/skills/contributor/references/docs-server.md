# Docs Pipeline and Dev Server (`server/`, outside `server/compiler/`)

`server/SERVER.md` is authoritative for the effects table, file signals, routes, HMR and config. `server/TESTS.md` covers test strategy, and `server/templates/README.md` covers templates. This file keeps only the traps those documents state less clearly. When you can, move each entry into `SERVER.md` and delete it here.

- **Go through the `RuntimeIO` seam** (`server/runtimes/`, `io`) for file IO, globbing and spawning on the build path; no `Bun.*` outside the seam except the dev server (`serve.ts`/`dev.ts`) and the Bun-only harnesses (`SERVER.md` → *The Runtime Seam*). Tests use `bun:test`.
- **The build is a cause-effect graph.** `List<FileInfo>` signals watch directories. **Build every effect with `createBuildEffect()`** (`server/effects/build-effect.ts`), which wraps `createEffect` + `match`; never hand-roll `ready`. A first-run failure rejects `ready`, so `build:docs` fails loudly. A later, watch-triggered failure is logged, and the effect waits for the next change. Effects write through `writeFileSafe()`, which creates the parent directory and returns `false` instead of throwing on a write error.
- **There are two `html` tags, and they produce different things.**
  - `templates/utils.ts`: auto-escaped **strings**, for page output.
  - `markdoc-helpers.ts`: Markdoc **`Tag`** objects.

  If a schema `transform()` uses the string tag, the page renders `[object Object]`.
- **All template interpolation is escaped.** Use `raw()` only for content that is already trusted: Shiki output, validated Markdoc output, or another template's output.
- **Pass every request-derived path through `guardPath(<the route's directory>, path)`** in `server/routes.ts` (e.g. `PAGES_DIR`, `ASSETS_DIR`, `COMPONENTS_DIR`). Take path constants from `server/config.ts` and never hardcode a path.
- **HMR runs only** when `NODE_ENV=development` and `PLAYWRIGHT` is unset.
- **A new Markdoc tag** needs three things: a schema in `server/schema/`, registration in `server/markdoc.config.ts` (the key is the `{% tag %}` name), and a test through `parse → transform → renderers.html` plus `validate`. Then add it to `SERVER.md` and `../writer/references/markdoc-tags.md`.
- **Test file layout mirrors the source** under `server/tests/`. Test the exported helpers, not the reactive machinery or third-party behavior.
- **Never hand-edit `docs/` or `docs-src/api/`.** Both are build output.
