# Implement Feature Workflow

## Required Reading

1. references/source-map.md — locate the right files
2. references/architecture.md — understand data flow and constraints
3. One of: references/effect-pattern.md | references/markdoc-schema.md | references/template-system.md

## Process

### Step 1: Scope check

Before writing any code, confirm the feature belongs in `server/`. If it touches:
- `src/` library source → use `le-truc-dev`
- `examples/` component authoring → use `le-truc` or `le-truc-dev`
- `docs-src/pages/*.md` content → use `tech-writer`
- `docs/` output files → never edit these manually; they are build artifacts

### Step 2: Identify the change surface

Use `references/source-map.md` quick-lookup to find the right files. Then read each file that needs changing — do not modify from memory.

Common change surfaces:
- **New build effect** → `server/effects/` + `server/build.ts` + `server/file-signals.ts` (if new signal needed)
- **New Markdoc tag** → use the `add-markdoc-schema` workflow instead
- **New HTTP route** → `server/serve.ts` + `server/config.ts` (new path constant if needed)
- **New template function** → `server/templates/`
- **Changed build output format** → the responsible effect file + its template(s)
- **HMR changes** → `server/serve.ts` (WebSocket) + `server/templates/hmr.ts` (client)

### Step 3: Implement

Follow the applicable pattern:

**For a new build effect:**
- Follow `references/effect-pattern.md` exactly
- Use `writeFileSafe()` from `server/io.ts` for all file writes
- Use path constants from `server/config.ts`; add new constants there if needed
- Register in `server/build.ts` (init, `Promise.all`, cleanup)

**For a new template function:**
- Import `html` from `./utils` (never from `../markdoc-helpers`)
- Wrap trusted sub-template output with `raw()`
- Let interpolation escape everything else automatically
- See `references/template-system.md` for full rules

**For a new HTTP route:**
- Add the route handler to `server/serve.ts`
- Always call `guardPath(BASE_DIR, userPath)` before serving any dynamic file path
- Add the route to the routes table in `server/SERVER.md`
- Add path constants to `server/config.ts` (use absolute paths via `join(ROOT, ...)`)

**For a new file signal:**
- Add to `server/file-signals.ts` using `watchFiles()` from `server/file-watcher.ts`
- Follow the existing signal naming pattern (`mySignal.sources`, `mySignal.processed`, etc.)

### Step 4: Write tests

For every new function or behavior:
- Pure helpers → unit test in the matching location under `server/tests/`
- File I/O → integration test using `createTempDir()` from `test-utils.ts`
- Markdoc schemas → test via `Markdoc.parse → transform → render` pipeline

Run `bun test server/tests` and verify all tests pass before moving on.

### Step 5: Update documentation

- Add/update the effects or routes table in `server/SERVER.md`
- Update `references/source-map.md` if a new file was created

### Step 6: Post-task protocol

Follow the post-task protocol defined in SKILL.md.

## Success Criteria

- Feature works correctly in `bun run dev` (watch mode)
- `bun test server/tests` passes, linter clean
- No hardcoded paths — all paths via constants from `server/config.ts`
- All file writes use `writeFileSafe()` (skips unchanged files)
- All dynamic paths guarded with `guardPath()` where applicable
- `server/SERVER.md` reflects the change
- TODO.md updated with handoff (if task was assigned via TODO.md)
