# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**Agent worktrees and the sandbox (LT-370/LT-335 sessions, 2026-10-02).** Four blockers, all
the sandbox's and not the code's. (1) `git commit` fails because the 1Password signing socket is
unreachable, so the owner commits. Never turn signing off. (2) An agent worktree comes up on
`main`'s head, not the current branch. `git reset --hard` then aborts halfway, because
`.agents/skills/**` (and `.vscode/`) are write-denied, and those paths keep `main`'s content in
the worktree. Never stage them. (3) `bun install` in a fresh worktree can hit a tempdir EPERM;
symlinking the main checkout's `node_modules` works, and the symlink must not be staged.
(4) `check:sim`'s Deno leg cannot create its npm cache. A fresh worktree also has no built
`docs/`, so `serve.test.ts` fails there with 404s until `build:docs` runs. For gate-touching work,
prefer the main checkout, or expect the owner to commit and re-run the gates.

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
