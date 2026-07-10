# PLAN: CI Guardrails — run CI on `next`, add server tests and a bundle-size gate

## Goal

Close three CI blind spots, verified against the current repo state:

1. **CI never runs for the active integration branch.** `.github/workflows/ci-cd.yml` triggers on `push`/`pull_request` for `[main, develop]` only. But the last four merged PRs (#57, #58, #59, #60 — verified via `gh pr list`) all had base branch `next`. Those PRs — including a security fix (#58) and the CEM feature (#60) — received **zero CI runs**. Worse, `develop` does not exist: `git ls-remote --heads origin` lists only `main`, `next`, and two feature branches. Half the branch filter is dead weight.
2. **The server test suite runs nowhere in CI.** `bun run test:server` (20+ test files under `server/tests/`) is not invoked by any workflow (`grep -rn "test:server" .github/workflows/` returns nothing).
3. **The bundle-size requirement is unenforced.** REQUIREMENTS.md §4 states: "Bundle size: ≤10 kB gzipped; hard ceiling 14 kB (one TCP segment)". A fresh minified build (`Bun.build`, `DEV_MODE=false`) gzips to **12,381 bytes** — already over the 10 kB target and only ~2 kB under the hard ceiling — and nothing in CI would catch crossing 14 kB.

## Alignment with Cause & Effect 1.4 distribution change

Cause & Effect 1.4 overhauled its package distribution (see its CHANGELOG "Changed" entry and `package.json`): the published entry point is now the **unminified** ESM bundle, an explicit `exports` map (`types` → `bun` → `default`) replaced `main`/`module`, the raw-TypeScript `"module": "index.ts"` field was removed, TypeScript became an optional peer dependency, a `files` allowlist replaced `.npmignore`, and the unused `index.dev.js` artifact was dropped. le-truc will follow the same model, and this plan must not fight it:

- **The size gate must not measure the on-disk `index.js`.** Once le-truc publishes unminified, the checked-in/published `index.js` gzip size is meaningless against REQUIREMENTS.md §4 — what matters is what a *consumer's bundler* ships. Cause & Effect solved this with `test/regression-bundle.test.ts`: build a fresh **minified** bundle in-memory via `Bun.build({ minify: true })` and gzip it with `node:zlib`'s `gzipSync`. le-truc adopts the identical pattern (same file name, same CI step name), so the gate stays correct regardless of what format the published artifact uses.
- **Branch filters mirror cause-effect's `ci.yml`: `[main, next]`.** Not `[main, develop, next]` — `develop` doesn't exist (verified above).
- **This plan gains a distribution-alignment step (Step 5)** mirroring the cause-effect `package.json` changes, since they interact with CI: the build script drops `--minify`, and `npm pack` contents move from `.npmignore` to a `files` allowlist.

Out of scope (noted for a follow-up, not this plan): cause-effect's CI also runs a non-mutating `bunx biome check .` and a separate `bunx tsc --noEmit` typecheck step, whereas le-truc's CI `Lint` step runs the **mutating** `biome check --write ./src`. Worth aligning later, but orthogonal to these guardrails.

## Exact files to touch

| File | Change |
|---|---|
| `.github/workflows/ci-cd.yml` | Replace branch filters with `[main, next]`; add `test:server` step; add bundle-size regression step |
| `test/regression-bundle.test.ts` | **New file** — gzip-size gate as a bun test (cause-effect pattern) |
| `package.json` | Add `"check:size"` script; distribution alignment: `exports` map, drop `module`, `files` allowlist, optional TS peer dep, unminified `build:prod` |
| `.npmignore` | **Delete** — superseded by the `files` allowlist |
| `.github/workflows/codeql.yml` | Replace branch filters with `[main, next]` (same blind spot) |
| `CHANGELOG.md` | **Required** (was optional): the distribution change is consumer-facing — write a "Changed" entry modeled on cause-effect 1.4's, and treat it as a **minor** version bump |

## Step-by-step implementation plan

### Step 1 — Create `test/regression-bundle.test.ts`

Mirror `cause-effect/test/regression-bundle.test.ts`: build in-memory with `Bun.build`, gzip with `node:zlib`. Two le-truc-specific differences: pass the `DEV_MODE=false` define (matching `build:prod`, otherwise dev-only code paths inflate the number), and warn-don't-fail between the 10 kB target and the 14 kB ceiling:

```ts
import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'node:zlib'

const TARGET = 10 * 1024
const CEILING = 14 * 1024

describe('Bundle size', () => {
	// REQUIREMENTS.md §4: ≤10 kB gzipped target, 14 kB hard ceiling (one
	// TCP segment). Measures a fresh minified build — what a consumer's
	// bundler ships — not the published (unminified) index.js.
	test('minified+gzipped bundle must stay under the 14 kB ceiling', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
			define: { 'process.env.DEV_MODE': 'false' },
		})
		// biome-ignore lint/style/noNonNullAssertion: test
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(
			`  bundleGzipped: ${gzipped}B (target: ${TARGET}B, ceiling: ${CEILING}B)`,
		)
		if (gzipped > TARGET) {
			console.warn(
				`  WARN: bundle exceeds the ${TARGET}B target (REQUIREMENTS.md §4)`,
			)
		}
		expect(gzipped).toBeLessThanOrEqual(CEILING)
	})
})
```

The top-level `test/` directory is new and safe: every existing test script passes an explicit path (`src/tests`, `server/tests`), so nothing picks this up accidentally — it runs only via the dedicated script/CI step.

### Step 2 — Add the package script

In `package.json` `"scripts"`, add:

```json
"check:size": "bun test test/regression-bundle.test.ts",
```

### Step 3 — Update `.github/workflows/ci-cd.yml`

1. Change both branch filters (mirroring cause-effect's `ci.yml`; `develop` doesn't exist):
   ```yaml
   on:
     push:
       branches: [main, next]
       tags: ['v*']
     pull_request:
       branches: [main, next]
   ```
2. Insert after the `Build` step (does not depend on the build output — it builds in-memory — but this spot groups it with the other artifact checks; name matches cause-effect):
   ```yaml
   - name: Bundle size regression
     run: bun run check:size
   ```
3. After the `Run tests` step (or before it — order doesn't matter, but keep it before the artifact upload), insert:
   ```yaml
   - name: Run server tests
     run: bun run test:server
   ```

### Step 4 — Update `.github/workflows/codeql.yml`

Replace its `push`/`pull_request` `branches` arrays with `[main, next]`, keeping the existing `paths-ignore` entries unchanged.

### Step 5 — Align package distribution with cause-effect 1.4

Mirror `@zeix/cause-effect@1.4.0`'s `package.json` (in `node_modules/@zeix/cause-effect/package.json` for reference):

1. **Publish unminified**: change `build:prod` to drop `--minify` and `--sourcemap=external` (consumers' bundlers minify anyway; readable source improves debugging). Delete the now-stale `index.js.map`, and drop `build:dev` + `index.dev.js` — it is referenced only by `biome.json`/`eslint.config.js` ignore patterns and the CHANGELOG, never imported (examples build from `index.ts` with their own `DEV_MODE` define). Remove the stale ignore-pattern entries too.
2. **`exports` map**, keeping the `customElements` field as-is:
   ```json
   "exports": {
   	".": {
   		"types": "./types/index.d.ts",
   		"bun": "./index.ts",
   		"default": "./index.js"
   	},
   	"./package.json": "./package.json",
   	"./custom-elements.json": "./custom-elements.json"
   },
   ```
3. **Remove `"module": "index.ts"`** — it points at raw TypeScript, which breaks webpack and older Rollup configs (same rationale as cause-effect).
4. **`files` allowlist replacing `.npmignore`** (then delete `.npmignore`):
   ```json
   "files": [
   	"index.js",
   	"index.ts",
   	"src",
   	"!src/tests",
   	"types",
   	"!types/src/tests",
   	"custom-elements.json",
   	"SECURITY.md"
   ],
   ```
   The negations matter: unlike the old `.npmignore`, a bare `"src"` entry would ship `src/tests/` (and `"types"` would ship `types/src/tests/`).
5. **Optional TypeScript peer dep**: keep `"peerDependencies": { "typescript": "^6.0.2" }` and add:
   ```json
   "peerDependenciesMeta": {
   	"typescript": {
   		"optional": true
   	}
   },
   ```
6. **CHANGELOG entry** (via the changelog-keeper skill): a "Changed" entry modeled on cause-effect 1.4's, including the migration notes — the `exports` map blocks deep imports into package internals, and anything reading the `module` field must switch to the `"bun"` condition or the bundled `index.js`. Minor version bump.

### Step 6 — Verify locally

```bash
bun run check:size                     # prints size, passes today (12,381 < 14,336)
bun run test:server                    # must pass before wiring into CI
bun run build && bun run test          # build without --minify must not break tests
npm pack --dry-run                     # tarball lists index.js, index.ts, src/ (no src/tests),
                                       # types/, custom-elements.json, SECURITY.md, README, LICENSE
node -e "import('@zeix/le-truc')"      # sanity: exports map resolves for a node consumer
                                       # (run inside a scratch dir with the packed tarball installed)
```

If `test:server` fails locally, fix or report the failures **before** adding the CI step — do not add a red step.

## Edge cases a weaker model would likely miss

- **Do not measure the on-disk `index.js`.** After Step 5 it is unminified, so its gzip size no longer relates to REQUIREMENTS.md §4. The gate must build minified in-memory (`Bun.build({ minify: true })`) — measuring what a consumer's bundler ships. This also removes the ordering dependency on `bun run build`.
- **The in-memory build must pass `define: { 'process.env.DEV_MODE': 'false' }`.** `build:prod` bakes `DEV_MODE=false`; without the define, dev-only branches survive minification and inflate the measurement (~12,394 B vs 12,381 B today — small now, but it drifts as dev-mode code grows).
- **Do not use `gzip -c index.js | wc -c` in CI.** `wc -c` output is whitespace-padded on macOS, gzip levels/headers can differ between platforms, and the gzip CLI embeds the filename+mtime in the header by default (making the byte count non-deterministic across runs). `node:zlib`'s `gzipSync` (the cause-effect pattern) avoids all of this.
- **The gate must be the 14 kB ceiling, not the 10 kB target.** The bundle is *already* 12,381 B. Failing at 10 kB would turn CI permanently red on day one. Fail at 14,336 B, warn above 10,240 B.
- **A bare `"src"` in the `files` allowlist ships the test suite.** `files` entries include directories wholesale; the `!src/tests` / `!types/src/tests` negations (or restructuring) are required to keep the tarball clean. Verify with `npm pack --dry-run`.
- **`custom-elements.json` must survive the `.npmignore` → `files` migration.** The `customElements` field points at it; the old `.npmignore` shipped it implicitly, an allowlist must name it explicitly. It is a build artifact (`bun run build:cem`) — confirm it exists before `npm pack`/publish (the publish workflow runs `bun run build`, which does **not** run `build:cem`; either add it to `build` or to the publish workflow).
- **`bun run test` already exists in CI and runs `bun test src/tests && playwright test examples`** — do not add a duplicate `test:src` step, and do not remove the Playwright browser-install step that precedes it.
- **`test:server` starts localhost HTTP servers in its integration tests** (see `server/TESTS.md`, "Server" category). It is designed for CI (temp dirs, localhost only) but takes up to ~2 s per server test — keep it as its own step so a timeout is attributable.
- **`npm-publish.yml` is release-triggered and needs no branch change**, but Step 5 affects it indirectly: it runs `bun run build` before `npm publish`, so the published artifact automatically becomes unminified once `build:prod` changes — no workflow edit needed (except the `build:cem` gap above).
- **Pushing this change to `next` itself won't trigger the workflow until it's merged** — the workflow file must exist on the branch *receiving* the push/PR base. The first verification happens on the PR that introduces it (if that PR targets `main`) or on the next push after merge.

## Acceptance criteria

1. `bun run check:size` passes and prints the gzipped byte count with target/ceiling context.
2. Temporarily editing `CEILING` in the test to `10 * 1000` and rerunning makes it fail (then revert) — proves the gate actually fails.
3. `bun run test:server` passes locally.
4. `.github/workflows/ci-cd.yml` and `.github/workflows/codeql.yml` both list exactly `[main, next]` under `push.branches` and `pull_request.branches` (verify with `grep -A3 "branches" .github/workflows/*.yml`).
5. `ci-cd.yml` contains the two new steps (`Bundle size regression`, `Run server tests`); visually confirm indentation matches sibling steps (GitHub validates YAML on push).
6. `npm pack --dry-run` lists `index.js` (unminified), `index.ts`, `src/` without `src/tests`, `types/` without `types/src/tests`, `custom-elements.json`, and `SECURITY.md`; no `index.dev.js`, no `index.js.map`, no `server/` or `docs/`.
7. `package.json` has the `exports` map, no `module` field, `peerDependenciesMeta.typescript.optional: true`; `.npmignore` is deleted; CHANGELOG has the distribution "Changed" entry with migration notes.
8. After merge, the Actions tab shows the CI/CD Pipeline workflow running on the next push or PR targeting `next`.
