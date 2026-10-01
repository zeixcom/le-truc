# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-379 (2026-10-01).** The probe's `<template>` tripwire leaves a diagnostic gap: loops.ts's
authored-`<template>` collision check became a structural tag scan moved before any selector
resolution (so the LTC007 diagnostic stays reachable for reactive lists), but a NON-loop
component that authors a `<template>` now fails the build on the probe's internal assertion
instead of today's silent answer — which counted content the browser never renders
(css-select's HTML mode skips `<template>` contents). Loud-over-wrong is the right trade, but
the crash copy is developer-facing, not author-facing. Candidate follow-up: a proper
authored-`<template>` refusal on both surfaces (sibling of LT-358d's LTC056 `<script>`
refusal, same shared lowering spot) — one diagnostic would let the probe's tripwire stay as
the unreachable backstop it wants to be.

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
