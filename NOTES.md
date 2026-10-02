# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-304 + LT-306 session (2026-10-02).** The scoped emission and the corpus migration landed
together; the pre-handoff review's rulings and blockers are in. Handoff:

- **Tech Writer owns the copy for LTC066–LTC070** (first drafts in `diagnostics.ts`):
  `ownTagLedRule` (LTC066), `slottedInLightDom` (LTC067), `hostContextSelector` (LTC068),
  `globalMisuse` (LTC069, six faces: nested / prefixed / trailing / leading-ancestor /
  mid-selector / declarations), `hostQualifier` (LTC070, fix-it `:host(<qualifier>)`).
  Lifecycle: `errors.md` rows, the ADR 0028 inventory row (adr-keeper), HOST_PROFILE § Styles
  (LT-248's docs half rewords it anyway). Diagnostic parity is pinned per code in
  `tsx/diagnostic-parity.test.ts`'s family list — the new codes ride the existing sweep; add a
  sample each if the family test requires one per family.
- **Pixel parity evidence (LT-306's Check):** full-page Playwright screenshots of every
  compiled component's `/test/<tag>` page, served from a HEAD worktree (before) vs this
  landing (after), default targets: 36/36 pre-existing components identical (basic-button,
  form-checkbox, form-listbox, form-spinbutton, module-codeblock, module-lazyload,
  module-list, module-listnav converged only after the sheets were brought to the twins'
  served content — the twins had drifted RICHER than the compiled sheets, and the compiled
  sheets had their own stale variants). The throwaway harness (`examples/__pixel/`) is
  deleted; the codeblock/listnav cross-boundary cases are pinned by the css-probe contract
  spec instead.
- **The codemod** (`scripts/migrate-shadow-css.ts`, kept for pioneer projects): SELECTOR
  TEXT ONLY, in place — authored values, nesting, comments and `light-dark()` never move.
  Modes: plain (tag-led → shadow form), `--from-twins` (sheet := migrated twin; the
  cross-boundary rules — content the component authors through a compose hole — hoist as
  whole-rule `:global`, at-rules carrying them into a top-level bare `:global` block),
  `--tests` (the one-shot fixture pass, already run). `--sync-twins` is gone (superseded).
- **The `:global` wrapper UNWRAPS on emission** — `:global(body.scroll-lock) { … }` emits
  `body.scroll-lock { … }` outside the scope, and the bare-block form's inner rules hoist
  unwrapped. Reading s6a's "emitted verbatim" as shipping the TSRX vocabulary itself would
  ship an invalid selector; the fixtures pin the unwrapped form. Flag if the copy should
  say "the wrapper unwraps".
- **Pre-existing, red at HEAD and here:** `bun run build:docs` fails the simulation gate with
  2 unclassified canvas entries on `<module-lazyload>` (proven in a HEAD worktree — same
  signature). Same family as the classified form-colorgraph rows; needs a
  `CLASSIFIED_DIAGNOSTICS` entry or a fixture fix. NOT this landing's regression.
- **check:contract residue** (LT-394's note): untouched — still red at HEAD; LT-394's path
  retires the toy.
- **Gate results:** server suite 2802/0; corpus warning baseline 0; census 36 entries
  (28 folded / 8 simulated — css-probe joins by design); check:corpus, check:portability
  (3 runtimes byte-identical), check:links green; corpus Playwright suite green once per
  mode (default lowered 533/533 incl. the 7 scoping-contract tests; native rebuild via a
  throwaway config — the env override was dropped per review, 497/497 + 7/7).
- **R2 note:** `server/effects/css.ts` keeps `--targets '>= 0.25%'` for the docs bundle —
  the reason is stated in the file (the site's own audience, not a component author's).

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
