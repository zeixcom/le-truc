# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

**Agent worktrees and the sandbox (LT-370/LT-335 sessions, 2026-10-02; trimmed 2026-10-04).**
Signing and the worktree base are settled by `scripts/worktree.ts` (unsigned task commits, signed
owner-run integration; worktrees branch from the current branch). Still open, all the sandbox's
and not the code's: (1) `bun install` in a fresh worktree can hit a tempdir EPERM; symlinking the
main checkout's `node_modules` works, and the symlink must not be staged. (2) `check:sim`'s Deno
leg cannot create its npm cache. (3) A fresh worktree has no built `docs/`, so `serve.test.ts`
fails there with 404s until `build:docs` runs. (4) Signed commits in the main checkout fail: the
1Password prompt never reaches an agent session, so the owner commits there.

---

**LT-379/LT-380 sessions (2026-10-01).** `cem.golden.test.ts`'s `bunx cem analyze` spawn
timed out twice (90s, always the form-checkbox test, the file's last invocation) during
heavy suite runs, then passed 5× standalone, in sequence, and at HEAD in a throwaway
worktree with the same node_modules — the known bunx-spawn flakiness (LT-273's
`spawnSync bunx` gotcha, Playwright-served variant), not a code regression. Re-run the file
once before diagnosing.

---
