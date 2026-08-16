# Effect Pattern

Standard build effect structure. Every effect follows this exact contract. Read before writing or modifying an effect.

## Effect Contract

Every effect factory in `server/effects/` calls `createBuildEffect()` (from `server/effects/build-effect.ts`) instead of hand-rolling `createEffect(() => match(...))` plus its own `ready`/`resolve`/`firstRun` bookkeeping. `createBuildEffect` owns that bookkeeping and gives every effect the same failure semantics:

- **A failure on the very first run rejects `ready`.** `build.ts` awaits every effect's `ready` in `Promise.all(...)`; a rejection propagates out of `buildOnce()` and fails the process (non-zero exit). A one-shot `build:docs` must fail loudly rather than silently shipping incomplete output — this is what stops a broken effect (a bad TypeDoc run, a schema type error, a failing subprocess) from quietly publishing a site missing a whole section.
- **A failure on a later run (file-watch rebuild) is logged and swallowed.** `ready` is already settled by then, so there's nothing to reject; the effect just waits for the next file change. A live dev server shouldn't crash because of a typo.
- **`onRebuild` is called automatically** after `run` succeeds on a non-first run — never call it yourself.

Every hand-rolled copy of this bookkeeping used to resolve `ready` unconditionally, even after an error — see ADR-worthy incident: a markdoc dependency bump broke TypeDoc's type-check, `apiEffect` logged the failure and resolved anyway, and the built site shipped with zero API pages. `createBuildEffect` exists so that class of bug can't recur silently.

## Minimal Pattern

```typescript
import { someSignal } from '../file-signals'
import { OUTPUT_DIR } from '../config'
import { createBuildEffect } from './build-effect'

export const myEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'My effect',           // label used in error logs
		[someSignal],           // tuple of signals, forwarded to match()
		async ([files]) => {    // do the work — write to docs/; throw on failure
			await writeOutput(files)
		},
		onRebuild,
	)
```

`run` receives the unwrapped signal values (one positional tuple element per signal, same as `match()`) and an optional second argument `{ firstRun }` if you need to branch on it (see `apiEffect` for the "skip TypeDoc if sources are unchanged" case, which doesn't need it, or `apiEffect`'s docs-src rescans, which don't either — most effects never need `firstRun` because `createBuildEffect` already handles the reject/swallow split for you).

## Rules

**Throw to fail.** Don't `console.error` and `return` on failure — throw (or let a rejected promise propagate). `createBuildEffect` decides whether that becomes a build failure (first run) or a logged-and-ignored rebuild (later run); an effect body should never make that decision itself.

**Don't call `onRebuild` yourself.** `createBuildEffect` calls it automatically after a successful non-first run.

**`run` receives values positionally as a tuple**, e.g. `match([a, b], { ok: ([aVal, bVal]) => ... } )`'s equivalent here is `run([aVal, bVal]) => ...`.

**Partial-failure tolerance inside a batch is still your call.** Some effects (`apiPagesEffect`, `examplesEffect`, `pagesEffect`) process many files and use a per-file `try/catch` so one bad file doesn't fail the whole run — keep that pattern where it applies; it's orthogonal to the outer first-run/later-run semantics `createBuildEffect` provides.

**Return `{ cleanup, ready }` — both fields required.** `createBuildEffect` returns this shape for you; effect factories just return its result directly. `build.ts` calls `cleanup?.()` on shutdown and awaits `ready` on startup.

## File I/O Conventions

- Use `writeFileSafe(path, content)` from `server/io.ts` — it skips writes when content is unchanged (hash check), preventing unnecessary downstream re-runs
- Use path constants from `server/config.ts` — never hardcode paths
- All output goes under `OUTPUT_DIR` (`docs/`) — never write outside this directory from an effect
- One exception: `apiEffect` writes to `docs-src/api/` (intermediate Markdown for the pipeline); `menuEffect` writes to `docs-src/includes/menu.html`

## External Process Pattern (CSS/JS/API effects)

When spawning an external tool (TypeDoc, LightningCSS, `bun build`), use `runCommand` (also from `server/effects/build-effect.ts`) instead of calling `Bun.spawn` directly — it inherits stdio and throws if the process exits non-zero, so a failing subprocess becomes a normal `run` failure:

```typescript
import { createBuildEffect, runCommand } from './build-effect'

export const myToolEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'My tool',
		[someSignal],
		async () => {
			console.log('Running my tool...')
			await runCommand(['bunx', 'my-tool', '--flag', 'value'])
			console.log('My tool succeeded')
		},
		onRebuild,
	)
```

`runCommand(cmd, options?)` takes the argv array and an optional `{ cwd }`.

## Registering a New Effect

1. Create `server/effects/my-effect.ts` following the pattern above
2. Import and initialize in `server/build.ts`:
   ```typescript
   const myEff = myEffect()
   // add to Promise.all:
   await Promise.all([..., myEff.ready])
   // add to the cleanup return:
   return () => { ...; myEff.cleanup?.() }
   ```
3. Add a test file at `server/tests/effects/my-effect.test.ts`
4. Add an entry to the effects table in `server/SERVER.md` and `references/source-map.md`
