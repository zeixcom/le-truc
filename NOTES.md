# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-275/LT-359/LT-389 round (2026-10-02).** Three residues for the Architect:

1. **LT-134 (BACKLOG) is mooted by LTC035's retirement.** Its premise — LTC035 and LTC042
   give opposite advice on the same construct — is gone with the code: no builder emits
   LTC035. Close it, or re-scope it to LTC042 alone if its residual point (a static id
   that LTC042 warns on can still collide across compose sites) deserves a row.
2. **`SurfaceWording.boundaries` has no consumer** since `duplicateIdAcrossArms` (its
   last reader) retired — `wording.boundary` (singular) is still live. Remove the key
   from `surface.ts` + both tables, or hold it for the next boundary-plural message;
   one-line developer call.
3. **ADR 0023 citations survive in pipeline module docs** outside LT-359(c)'s ruled
   sweep (diagnostics copy + message-bearing call sites + errors.md + CHANGELOG):
   `config.ts`, `ir.ts`, `compose-attrs.ts`, `classify-attributes.ts`, `imports.ts`,
   `extract-context.ts`, `runtime.ts` JSDoc, `spans.ts`, `emit-server.ts`,
   `emit-client.ts`, `registry.ts`, `assemble-ir.ts`, `walk.ts`, `core.ts`,
   `core-shim.d.ts`, `css.ts`, `vocabulary.ts`, `setup-extraction.ts`, `ast-utils.ts`,
   `analysis/{harvest,plan,selectors,effects}.ts` comments, `lower-shared.ts` JSDoc and
   the `frontend/tsrx/*` docs. Per the ruling these are the same wrong number; a
   developer-side sweep (or an explicit descope) is needed — Tech Writer's file scope
   ends at the diagnostic copy.

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
