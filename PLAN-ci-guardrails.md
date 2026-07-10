# PLAN: CI Guardrails — run CI on `next`, add server tests and a bundle-size gate

## Goal

Close three CI blind spots, verified against the current repo state:

1. **CI never runs for the active integration branch.** `.github/workflows/ci-cd.yml` triggers on `push`/`pull_request` for `[main, develop]` only. But the last four merged PRs (#57, #58, #59, #60 — verified via `gh pr list`) all had base branch `next`. Those PRs — including a security fix (#58) and the CEM feature (#60) — received **zero CI runs**.
2. **The server test suite runs nowhere in CI.** `bun run test:server` (20+ test files under `server/tests/`) is not invoked by any workflow (`grep -rn "test:server" .github/workflows/` returns nothing).
3. **The bundle-size requirement is unenforced.** REQUIREMENTS.md §4 states: "Bundle size: ≤10 kB gzipped; hard ceiling 14 kB (one TCP segment)". The current `index.js` gzips to **12,174 bytes** — already over the 10 kB target and only ~2 kB under the hard ceiling — and nothing in CI would catch crossing 14 kB.

## Exact files to touch

| File | Change |
|---|---|
| `.github/workflows/ci-cd.yml` | Add `next` to push and pull_request branch lists; add `test:server` step; add bundle-size step |
| `scripts/check-bundle-size.ts` | **New file** — gzip-size gate script |
| `package.json` | Add `"check:size"` script |
| `.github/workflows/codeql.yml` | Add `next` to push/pull_request branch lists (same blind spot) |
| `CHANGELOG.md` | Optional: no entry needed (CI-only change, no library behavior change) — skip unless the changelog-keeper skill says otherwise |

## Step-by-step implementation plan

### Step 1 — Create `scripts/check-bundle-size.ts`

Use `Bun.gzipSync` rather than the `gzip` CLI so the number is identical on macOS and ubuntu runners:

```ts
/**
 * Gate the published bundle size against REQUIREMENTS.md §4:
 * target ≤ 10 kB gzipped, hard ceiling 14 kB (one TCP segment).
 * Fails the build only when the hard ceiling is exceeded.
 */
const TARGET = 10 * 1024
const CEILING = 14 * 1024

const buf = await Bun.file('index.js').arrayBuffer()
const gzipped = Bun.gzipSync(new Uint8Array(buf)).byteLength

console.log(
	`index.js: ${gzipped} B gzipped (target ${TARGET} B, hard ceiling ${CEILING} B)`,
)
if (gzipped > CEILING) {
	console.error(
		`FAIL: bundle exceeds the ${CEILING} B hard ceiling (REQUIREMENTS.md §4)`,
	)
	process.exit(1)
}
if (gzipped > TARGET) {
	console.warn(`WARN: bundle exceeds the ${TARGET} B target (REQUIREMENTS.md §4)`)
}
```

Important: the script must run **after** `bun run build` (which regenerates `index.js` minified). It measures the production bundle, not `index.dev.js`.

### Step 2 — Add the package script

In `package.json` `"scripts"`, add (keep alphabetical-ish grouping with the other `verify`/`check` scripts):

```json
"check:size": "bun scripts/check-bundle-size.ts",
```

### Step 3 — Update `.github/workflows/ci-cd.yml`

1. Change both branch filters:
   ```yaml
   on:
     push:
       branches: [main, develop, next]
       tags: ['v*']
     pull_request:
       branches: [main, develop, next]
   ```
2. After the existing `Build` step (which runs `bun run build`), insert:
   ```yaml
   - name: Check bundle size
     run: bun run check:size
   ```
3. After the `Run tests` step (or before it — order doesn't matter, but keep it before the artifact upload), insert:
   ```yaml
   - name: Run server tests
     run: bun run test:server
   ```

### Step 4 — Update `.github/workflows/codeql.yml`

Add `next` to its `push`/`pull_request` `branches` arrays, keeping the existing `paths-ignore` entries unchanged.

### Step 5 — Verify locally

```bash
bun run build && bun run check:size    # prints size, exits 0 today (12,174 < 14,336)
bun run test:server                    # must pass before wiring into CI
```

If `test:server` fails locally, fix or report the failures **before** adding the CI step — do not add a red step.

## Edge cases a weaker model would likely miss

- **Do not use `gzip -c index.js | wc -c` in CI.** `wc -c` output is whitespace-padded on macOS, gzip levels/headers can differ between platforms, and the gzip CLI embeds the filename+mtime in the header by default (making the byte count non-deterministic across runs). `Bun.gzipSync` avoids all of this.
- **The gate must be the 14 kB ceiling, not the 10 kB target.** The bundle is *already* 12,174 B. Failing at 10 kB would turn CI permanently red on day one. Fail at 14,336 B, warn above 10,240 B.
- **`bun run test` already exists in CI and runs `bun test src/tests && playwright test examples`** — do not add a duplicate `test:src` step, and do not remove the Playwright browser-install step that precedes it.
- **`test:server` starts localhost HTTP servers in its integration tests** (see `server/TESTS.md`, "Server" category). It is designed for CI (temp dirs, localhost only) but takes up to ~2 s per server test — keep it as its own step so a timeout is attributable.
- **`npm-publish.yml` is release-triggered and needs no change.** Only `ci-cd.yml` and `codeql.yml` have the branch blind spot.
- **Pushing this change to `next` itself won't trigger the workflow until it's merged** — the workflow file must exist on the branch *receiving* the push/PR base. The first verification happens on the PR that introduces it (if that PR targets `main`) or on the next push after merge.

## Acceptance criteria

1. `bun run check:size` exits 0 and prints the gzipped byte count with target/ceiling context.
2. Temporarily editing `CEILING` in the script to `10000` and rerunning makes it exit 1 (then revert) — proves the gate actually fails.
3. `bun run test:server` passes locally.
4. `.github/workflows/ci-cd.yml` and `.github/workflows/codeql.yml` both list `next` under `push.branches` and `pull_request.branches` (verify with `grep -A3 "branches" .github/workflows/*.yml`).
5. `ci-cd.yml` contains the two new steps (`Check bundle size`, `Run server tests`) and `bunx biome check` / YAML linting raises no syntax errors (a quick `bun x yaml-lint` is unnecessary — GitHub validates on push; visually confirm indentation matches sibling steps).
6. After merge, the Actions tab shows the CI/CD Pipeline workflow running on the next push or PR targeting `next`.
