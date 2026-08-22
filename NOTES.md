# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## Resolved 2026-08-21 (architect review of LT-001/LT-002)

- `@tsrx/core` 0.1.60 AST gotchas — incorporated in `server/tsrx/core-shim.d.ts` and `compiler.ts` headers (JSXIdentifier names, `JSXStyleElement`, `JSXCodeBlock`/`JSXForExpression` shapes, `&`-as-text lazy child, broken `isEventAttribute`/`normalizeEventName` helpers).
- Generated-code vs. library surface — factory-context members are not module exports; number-valued attribute thunks stringify. Encoded in `emit-client.ts` and pinned by the emit-then-check test.
- Golden `.html` pages are example pages, not render fixtures — resolved by owner decision: golden tests assert every demo *variant* is representable as `render(args)` (see `server/tests/tsrx/server.golden.test.ts` header).
- No DOM in `bun test` — behavioral E2E of generated clients is deferred to the docs/examples migration (Playwright); acceptance evidence is emit-then-check plus snapshot convergence.
