# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-397 session (2026-10-02).** `bun run build:docs` still fails the simulation gate: 2
unclassified canvas notices (`Not implemented: HTMLCanvasElement.getContext`) attributed to
module-lazyload — pre-existing at HEAD (the LT-306 session proved the same signature in a
worktree). A standing `CLASSIFIED_DIAGNOSTICS` entry mirroring module-colorinfo's was tried
and correctly REJECTED by the baseline test (LT-163 in `sim-driver.test.ts`): in the suite's
corpus run the notice never reaches module-lazyload — the leak is page-render-order-dependent,
a build:docs-only phenomenon — so the classification is dead there. The honest fix is
LT-335's (drain composed closures before a window closes, or origin-tag the diagnostics),
which also retires the module-colorinfo/module-coloreditor workarounds. LT-397's content
check (`docs/assets/main.css` holds the `:where(<tag>)` rules) is satisfiable anyway: the CSS
bundle is written before the gate fires. Second pre-existing: `build:examples:css` warns
`Invalid selector … 'state'` — the twins' hand-written CSS carries `:state()`, which
lightningcss's bundle target does not know; cosmetic, both trees. All of LT-397's verification
was re-run after the owner's LT-405 rollback (same day): 33/35 pages pixel-identical per mode,
corpus Playwright 990/0 per mode. One flake class learned the hard way: full-page PNG
byte-comparison can produce encoder-level false positives (module-pagination differed in bytes
while every pixel band was identical) — pixel-band-check before chasing a diff.

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
