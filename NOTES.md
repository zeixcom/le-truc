# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

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
