# Effect Pattern

Standard build effect structure. Every effect follows this exact contract. Read before writing or modifying an effect.

## Effect Contract

Every effect factory in `server/effects/` must:
1. Create a `ready` promise and capture its resolver
2. Call `createEffect(() => match([...signals], { ok, err }))`
3. Resolve `ready` in **both** the `ok` and `err` handlers (typically in `finally`)
4. Return `{ cleanup, ready }`

`build.ts` awaits all `ready` promises to know when the initial build is done. If `ready` never resolves, the build hangs indefinitely.

## Minimal Pattern

```typescript
import { createEffect, match } from '@zeix/cause-effect'
import { someSignal } from '../file-signals'
import { OUTPUT_DIR } from '../config'

export const myEffect = () => {
    let resolve: (() => void) | undefined
    const ready = new Promise<void>(res => { resolve = res })

    const cleanup = createEffect(() => {
        match([someSignal], {
            ok: async (files) => {
                try {
                    // Do the work — write to docs/
                    await writeOutput(files)
                } catch (error) {
                    console.error('myEffect failed:', String(error))
                } finally {
                    resolve?.()
                    resolve = undefined   // prevent double-resolve
                }
            },
            err: errors => {
                console.error('Error in myEffect:', errors[0]!.message)
                resolve?.()
                resolve = undefined
            },
        })
    })

    return { cleanup, ready }
}
```

## Rules

**`resolve` becomes `undefined` after first call.** The pattern `resolve?.(); resolve = undefined` ensures `ready` resolves exactly once on the first run. Subsequent re-runs (triggered by file changes) do not touch `ready`.

**`ok` receives the unwrapped signal values.** `match([a, b], { ok: (aVal, bVal) => ... })` — values are passed positionally, one argument per signal.

**Always `await` async work inside `ok`.** The effect system is synchronous; if you don't await, errors won't be caught and `ready` may resolve prematurely.

**Errors inside `ok` must be caught manually.** `match` does not catch exceptions thrown inside the `ok` callback. Always wrap with `try/catch/finally`.

**The `err` path fires when any signal is in error state.** Log the error and still resolve `ready` so the build doesn't hang.

**Return `{ cleanup, ready }` — both fields required.** `build.ts` calls `cleanup?.()` on shutdown and awaits `ready` on startup.

## File I/O Conventions

- Use `writeFileSafe(path, content)` from `server/io.ts` — it skips writes when content is unchanged (hash check), preventing unnecessary downstream re-runs
- Use path constants from `server/config.ts` — never hardcode paths
- All output goes under `OUTPUT_DIR` (`docs/`) — never write outside this directory from an effect
- One exception: `apiEffect` writes to `docs-src/api/` (intermediate Markdown for the pipeline); `menuEffect` writes to `docs-src/includes/menu.html`

## External Process Pattern (CSS/JS effects)

When spawning an external tool (e.g., LightningCSS, `bun build`):

```typescript
ok: async () => {
    try {
        const proc = Bun.spawn(['bunx', 'tool', ...args], {
            stdout: 'inherit',
            stderr: 'inherit',
        })
        const exitCode = await proc.exited
        if (exitCode !== 0) {
            console.error(`tool failed with exit code ${exitCode}`)
        }
    } catch (error) {
        console.error('tool error:', String(error))
    } finally {
        resolve?.()
        resolve = undefined
    }
}
```

Use `Bun.spawn` (not `child_process`). Check `proc.exited` for the exit code.

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
