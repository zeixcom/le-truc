# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## LT-005 — format gaps surfaced by the form-textbox fixture
**Date:** 2026-08-22 | **Skill:** le-truc-dev
**Issue:** The extension-activation spike (ADR 0023 sub-design 8) compiles, but five shapes of the real hand-written form components remain unrepresentable — tracked in TODO.md LT-005 "Open for the full form migration", not yet ticketed:
1. **`length`-style signals** — initializers over server args (`createCell(value.length)`) whose client seed must come from the DOM need an arg→DOM-site substitution harvest rule (the arg's rendered attribute site → element-derived read). The fixture omits `length` and its `hidden` visibility binding.
2. **Setup side-effect statements** — `internals?.states.add('clearable')` is outside the setup subset (const + expose only). Custom `:state()` hooks need a format decision: a reactive `state={…}` attribute vs. relaxing the setup subset.
3. **`@if`** — the hand-written form-textbox renders `<input>` OR `<textarea>`; no conditional template construct exists yet, so the fixture is input-only.
4. **Parser ambients** — `asClampedInteger`/`asJSON` are not recognized (asString/asInteger/asNumber/asBoolean/asEnum are); `@tsrx/core` rejects HTML-style bare void elements (`<input>` must self-close as `<input />`).
5. **`formAssociatedCheckbox`** — emitted and validated by the compiler but no corpus fixture exercises the checked variant yet.
**Question:** None blocking — all deferred by scope decision; item 1 bites first when form-textbox migrates for real.

## LT-007 — TypeScript 6.0.3 fails to parse doc comments containing `**`
**Date:** 2026-08-21 | **Skill:** le-truc-dev
**Issue:** Any `/** … */` comment whose text includes `**` — e.g. the glob `examples/**/*.tsrx` — produces `TS1109: Expression expected` at the `**` under TypeScript 6.0.3, apparently from markdown-bold handling inside JSDoc. Backticks make no difference; plain `@for` and backticked `` `@for` `` are fine.
**Options:** (a) verify on a clean install, minimize, report upstream (queued as LT-007); (b) repo workaround only — spell globs without `**` in doc comments (currently applied across `server/tsrx/`).
**Question:** None — workaround in place; upstream report pending LT-007.

## Resolved 2026-08-21 (architect review of LT-001/LT-002)

- `@tsrx/core` 0.1.60 AST gotchas — incorporated in `server/tsrx/core-shim.d.ts` and `compiler.ts` headers (JSXIdentifier names, `JSXStyleElement`, `JSXCodeBlock`/`JSXForExpression` shapes, `&`-as-text lazy child, broken `isEventAttribute`/`normalizeEventName` helpers).
- Generated-code vs. library surface — factory-context members are not module exports; number-valued attribute thunks stringify. Encoded in `emit-client.ts` and pinned by the emit-then-check test.
- Golden `.html` pages are example pages, not render fixtures — resolved by owner decision: golden tests assert every demo *variant* is representable as `render(args)` (see `server/tests/tsrx/server.golden.test.ts` header).
- No DOM in `bun test` — behavioral E2E of generated clients is deferred to the docs/examples migration (Playwright); acceptance evidence is emit-then-check plus snapshot convergence.
