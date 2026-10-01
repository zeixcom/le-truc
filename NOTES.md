# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**LT-385 session (2026-10-02).** The review's (c) rider "Same rule for boundary templates"
turned out to be already enforced structurally: the boundary's grammar admits exactly one
client-written site per arm — the recognized value child on the arm root, which `emitArmRoot`
bakes empty when `value` is null (LT-276). A lazy site BELOW the arm root is LTC005
("Deeper elements have no addressing"), and a reactive attribute ON the arm root is also
LTC005 ("That root takes static and server attributes and its one lazy signal child only").
So no legal boundary template can hit the wrong-condition evaluation; the new
`inArmTemplate` emit flag covers it as defense-in-depth only, pinned by the emptiness
render test (already-true behavior), not by a failing-first one. The failing-first (c) pins
are the conditional face's (lazy text + reactive attribute/class map).

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
