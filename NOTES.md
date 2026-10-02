# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-268 session (2026-10-02).** The stylesheet parse landed with three decisions worth
the Architect's eyes, two residues found, and one Tech Writer handoff.

- **`lightningcss-wasm`, not the native `lightningcss` napi binding.** The native package
  cannot ride `check:portability`'s self-contained bundle: its platform require resolves
  from the bundle's location, and Deno refuses to consult a carried `node_modules` by
  design (its own error says NAPI npm packages need a Deno-managed install). The wasm
  distribution is the same Rust parser (1.33.0, in lockstep with the CLI), self-contained
  under bun/node/deno — proven green, byte-identical output on all three. ADR 0033 s9
  names "lightningcss"; if the distribution choice deserves a line in the ADR, it rides
  LT-304's next ADR touch.
- **LT-304 hazard: the lightningcss write path crashes at 1.33.** Returning parsed nodes
  from the visitor (the write path scoped emission would use) fails with
  "failed to deserialize; expected an object-like struct named Specifier, found ()"
  whenever a nested rule's declaration contains `var()` — plain read-only collection is
  fine (the corpus parses clean). Upstream-issue candidate before LT-304 designs emission.
- **css-tree rides as `css-tree/dist/csstree.esm.js`** (a designated exports path): the
  package entry loads its dictionary patch through a runtime `createRequire`, which also
  cannot ride the portability bundle. It ships no TypeScript declarations, so
  `server/compiler/css-tree.d.ts` is the ambient shim, `core-shim.d.ts` pattern. Grammar
  arbitration is `lexer.matchDeclaration` per declaration — exemptions: custom properties,
  `var()`/`env()` values (css-tree refuses substitution), at-rule descriptors (not
  properties), Raw values. Corpus-probed: 1250 declarations across 38 sheets, 0 false
  positives; `^3.2.1` caret so dictionary refreshes ride minor bumps.
- **Tech Writer handoff (LTC064).** Three faces, first drafts in `diagnostics.ts`:
  `malformedStyleSheet` (parse refusal), `unknownCssProperty`, `invalidCssValue` (echoes
  the value text). Message equality across surfaces is pinned by the
  `diagnostic-parity.test.ts` case "LTC064 stylesheet: an invalid unit". Remaining
  lifecycle: `errors.md` rows, the ADR 0028 inventory-table row (LT-359d pattern, via
  adr-keeper), and the HOST_PROFILE sentence LT-268 already amended stays theirs to
  re-word if the copy round touches it.
- **Residue (pre-existing, red at HEAD b7d2f81c+5254edfc):** `check:contract` — the toy
  IR literal in `scripts/contract-check.ts` predates LT-287/LT-288 (it still writes
  `exposeText`/`exposeKinds`/`refReasons`; `emit-server.ts` reads `component.expose`).
  LT-268 added only the one clearly-required `firstRefs: new Map()`; a real toy refresh
  against the current IR is owed. Also `tsc` flags
  `server/tests/compiler/diagnostics.test.ts:2338` (TS2367: `d.code === 'LTC035'`
  against the union LTC035 retired in `ac0b8d83`) — bun test passes, typecheck does not.
- **Gates:** server suite 2764 pass / 0 fail (14 new in `css.test.ts` + the parity case);
  `tsc` clean outside the residue above; `check:portability` green (3 runtimes,
  byte-identical); `check:links` green; `lint:server` clean; a full corpus rebuild
  produced zero artifact diffs (emitted CSS byte-identical, the task's first Check).

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
