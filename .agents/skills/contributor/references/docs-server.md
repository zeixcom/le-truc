# Docs Pipeline and Dev Server (`server/`, outside `server/compiler/`)

`server/SERVER.md` is authoritative for the effects table, file signals, routes, HMR and config. `server/TESTS.md` covers test strategy, and `server/templates/README.md` covers templates. This file keeps only the traps those documents state less clearly. When you can, move each entry into `SERVER.md` and delete it here.

- **Use Bun APIs** (`Bun.serve`, `Bun.Glob`, `Bun.file`, `bun:test`). Do not use the `node:fs`, `node:http` or `node:path` equivalents.
- **The build is a cause-effect graph.** `List<FileInfo>` signals watch directories. Each effect is `createEffect` + `match`, and it writes through `writeFileSafe()`, which skips writes when the content is unchanged.
- **There are two `html` tags, and they produce different things.**
  - `templates/utils.ts`: auto-escaped **strings**, for page output.
  - `markdoc-helpers.ts`: Markdoc **`Tag`** objects.

  If a schema `transform()` uses the string tag, the page renders `[object Object]`.
- **All template interpolation is escaped.** Use `raw()` only for content that is already trusted: Shiki output, validated Markdoc output, or another template's output.
- **Every effect resolves `ready` on every path**, including `err`. Resolve it in `finally`. A missed resolve hangs the build.
- **Pass every dynamic path through `guardPath(BASE_DIR, path)`.** Take path constants from `server/config.ts` and never hardcode a path.
- **HMR runs only** when `NODE_ENV=development` and `PLAYWRIGHT` is unset.
- **A new Markdoc tag** needs three things: a schema in `server/schema/`, registration in `server/markdoc.config.ts` (the key is the `{% tag %}` name), and a test through `parse → transform → renderers.html` plus `validate`. Then add it to `SERVER.md` and `../writer/references/markdoc-tags.md`.
- **Test file layout mirrors the source** under `server/tests/`. Test the exported helpers, not the reactive machinery or third-party behavior.
- **Never hand-edit `docs/` or `docs-src/api/`.** Both are build output.
