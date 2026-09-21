# Compiler Vocabulary Ledger (LT-271)

The disposition of every TSRX-only name the compiler carried, with the reason.
Settled 2026-09-19 under [ADR 0034](../../adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md)
s1–s2, discharging the packaging-time deferrals [LT-206](../../DONE.md) parked.

**The rule this ledger applies.** `.tsrx` remains a first-class *repo-internal*
authoring surface under [ADR 0032](../../adr/0032-adopt-tsx-as-the-authored-component-surface.md)
s6's parity contract, so a name that refers to the `.tsrx` surface refers to it
*correctly* and is kept. A name that refers to the surface-neutral machinery —
or to a thing that already handles both surfaces — is renamed. A blanket rename
would have been as wrong as none.

---

## 1. Script names

| Name | Disposition | Reason |
|---|---|---|
| `check:tsrx` → **`check:corpus`** | renamed | `scripts/check-tsrx.ts` already globbed `examples/**/*.tsrx` **and** `examples/**/*.tsx` (LT-202). It type-checks the whole corpus through emit-then-check, whichever front end produced each module. The name was wrong before the publish question arose. File renamed to `scripts/check-corpus.ts`. |
| `scripts/build-tsrx.ts` → **`scripts/build-corpus.ts`** | renamed | The standalone corpus emit that `typecheck`, `build:cem`, `build:examples:js` and `check:nosubstrate` all run. It emits for whatever the corpus contains; nothing about it is `.tsrx`-specific except today's corpus. |
| **`build:corpus`** | added | `build:tsrx` was named in the LT-206 deferral list but never existed as a `package.json` script — only as a file four other scripts invoked inline. Added so the renamed script is addressable, and so the deferral list is discharged honestly rather than by a technicality. |
| `build:tsrx:browser` / `scripts/build-tsrx-browser.ts` | **kept** | Bundles `server/compiler/frontend/tsrx/index.ts` specifically — the `.tsrx` front end — for the [ADR 0025](../../adr/0025-client-side-component-playground.md) playground compile worker. The `.tsx` front end has no browser bundle and is not in this artifact. The name is accurate; renaming it would make it less so. Output stays at `server/generated/tsrx-browser/`. |

**Known gap, not fixed here (deliberate).** `scripts/build-corpus.ts` globs
`examples/**/*.tsrx` only, while `scripts/check-corpus.ts` and the build effect
glob both extensions. A `.tsx` component added under `examples/` would compile
under `bun run check:corpus` and the docs build but be missed by
`build:corpus` — so `build:cem` and `typecheck` would not see it. This is a
behavioural defect, not a naming one, and LT-271 is a rename sweep whose
acceptance criterion is byte-identical corpus output; widening the glob is a
separate change. **Ruled at the LT-271 review: LT-255 owns it** — that task replaces this
glob with a configured one, and the requirement to cover both extensions is written
into its entry. **Closed by LT-255 (2026-09-19):** both extensions are now one
configured glob list (`DEFAULT_SOURCES` in `server/compiler/corpus-config.ts`), read
by `build:corpus`, `check:corpus` and the build effect alike — there is a single
place to widen, so the three cannot drift apart again.

## 2. Module and directory names

| Name | Disposition | Reason |
|---|---|---|
| `server/effects/tsrx.ts` → **`server/effects/compile.ts`** | renamed | Watches `.tsrx` **and** `.tsx` (ADR 0032 s6) and dispatches per extension. It is the component-compile effect, not the TSRX effect. Symbols moved with it: `compileTsrxCorpus` → `compileCorpus`, `tsrxEffect` → `compileEffect`. |
| `componentTsrx` / `componentTsrxSources` (`server/file-signals.ts`) → **`componentFiles` / `componentSources`** | renamed | The signal already watched both extensions. |
| `loadTsrxCorpus` (`server/tests/compiler/corpus-fixture.ts`) → **`loadCorpus`** | renamed | Loads the corpus, both surfaces. |
| `simulateTsrxCorpus` (`server/effects/simulate.ts`) → **`simulateCorpus`** | renamed | Simulation is machinery, surface-independent ([ADR 0027](../../adr/0027-server-simulation.md)). |
| `server/generated/tsrx/` → **`server/generated/components/`** | renamed | Holds both surfaces' output — `<tag>.server.ts`, `<tag>.client.ts`, `<tag>.css`, `registry.json`, `i18n.ts`. Gitignored; nothing downstream pins the path except in-repo callers, all updated. |
| `server/tests/helpers/generated-tsrx.ts` → **`server/tests/helpers/generated-corpus.ts`** | renamed | Its scratch-directory prefix moved with it: `tsrx-test-<label>-` → `corpus-test-<label>-`. |
| `server/generated/tsrx-browser/` | **kept** | See `build:tsrx:browser` above — it really is the `.tsrx` front end's bundle. |

## 3. `@tsrx/core` in internal APIs

| Name | Disposition | Reason |
|---|---|---|
| `import type { TsrxNode } from '@tsrx/core'` in **21 machinery modules** → **`import type { AstNode } from './ast-node'`** | renamed | This was the real finding. The shared machinery — `ast-utils`, `ir`, `evaluability`, `imports`, `setup-extraction`, `lower-shared`, `emit-server`, `analysis/*`, `tier` and the rest — typed its whole AST vocabulary on a name and a package specifier belonging to the minority surface's parser. It is a loose estree structural type (`{ type: string; start?; end?; … }`), and the `.tsx` front end was *redeclaring an identical copy* in `frontend/tsx/to-estree.ts` precisely because the shared one was misnamed. New machinery-owned `server/compiler/ast-node.ts` exports `AstNode`; `to-estree.ts` re-exports it instead of redeclaring. Type-only, erased at compile time — zero runtime effect. |
| `server/compiler/core.ts` | **kept** | The ONE module importing the pin's *values*. Its doc comment updated: siblings now import no types from `@tsrx/core` either, so `core.ts` + `core-shim.d.ts` are the pin's entire footprint — tighter isolation than ADR 0024 s2 asked for. |
| `server/compiler/core-shim.d.ts`, incl. its own `TsrxNode` | **kept** | This declaration really *is* the pinned parser's type, for the pinned parser's own function signatures. Naming it after the package is correct. |
| `@tsrx/core` in `package.json` devDependencies | **kept** | ADR 0032 s6 retains the pin while `.tsrx` lives. |
| `import type { TsrxNode } from '@tsrx/core'` in `scripts/codemod-react-jsx.ts` | **kept** | A `.tsrx`-only codemod (the React-idiom migration), parsing `.tsrx` with `@tsrx/core`. Correct reference. |

## 4. Diagnostic codes — the load-bearing decision

**Owner ruling, 2026-09-19: split by ownership. 44 codes → `LTC###`; 6 keep `TSRX###`.**

These become public API at first publish ([ADR 0034](../../adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md)
s1), and a package name is the one decision that cannot be revised afterwards —
so the vocabulary is settled now, before P6, even though the publish is after it.

**Renamed to `LTC###`** (`@zeix/le-truc-compiler`), numbers preserved:
`LTC001`–`LTC017`, `LTC019`, `LTC025`–`LTC050`.

> These are emitted by the shared machinery and fire on both surfaces. At v3.0
> the published package contains the `.tsx` front end only (ADR 0034 s2), so
> every code an outside author can see would otherwise have been named after a
> format they cannot author. Numbers are preserved so the ADR 0028 spent-number
> ledger survives the rename intact — `TSRX004`/`013`/`031`/`043`'s retirements
> and `TSRX020`'s carry over as `LTC004`/`013`/`031`/`043` and stay visible in
> the union.

**Kept as `TSRX###`:** `TSRX018`, `TSRX020`, `TSRX021`, `TSRX022`, `TSRX023`,
`TSRX024`.

> These diagnose the `.tsrx` grammar specifically and have no `.tsx` counterpart
> by construction. `TSRX018` is the retired `&{…}` lazy-child sigil; `TSRX020` is
> retired at the 0.2 pin; `TSRX021`–`TSRX024` are the React near-miss family
> (`{cond && …}`, ternary, `.map()`, `return (<>…</>)`) — idioms that TSRX would
> render *literally* but which are `.tsx`'s **correct** spellings, so the family
> is in force for `.tsrx` sources only (ADR 0032 s6). Prefixing them `LTC` would
> assert they are compiler-wide rules, which is exactly backwards. None of them
> is in the v3.0 published package.

**Why not a blanket rename**, the alternative considered: it costs one prefix to
learn instead of two, but it erases the only information that distinguishes a
surface rule from a machinery rule, and it names `.tsrx` grammar checks after a
compiler surface they do not apply to. The two prefixes are unambiguous by
number — the spaces do not overlap — and the union stays a single type.

**Why not keep `TSRX` for all 50**, the other alternative: it is free, and the
codes *are* one contiguous number space. But the `.tsx` author who gets
`TSRX023` for a format they cannot use is the concrete cost, paid forever,
because renaming after first publish is impossible.

**`LTC` rather than `LT`:** `LT-###` is this repo's task-ID namespace
(`LT-206`, `LT-271`). `LT034` beside `LT-034` in prose is a collision waiting to
happen.

## 5. Kept, with the surface named correctly

Not part of the LT-206 list, but checked in the same sweep and left alone: the
`.tsrx` corpus sources under `examples/`, `server/compiler/frontend/tsrx/`,
`server/tests/compiler/tsx/parity.test.ts`, and every prose reference that
describes the `.tsrx` grammar, its pin, or its front end. The surface set is
closed at two (ADR 0032 s6) and both are named explicitly wherever the
distinction matters.

---

## Verification

Run at LT-271, against the pre-sweep tree:

- **Corpus output byte-identical: 67 of 69 artifacts.** The two differences are
  the renamed vocabulary itself, not different emission:
  - `i18n.ts` — its generated provenance header names the script that writes it
    (`scripts/build-tsrx.ts` → `scripts/build-corpus.ts`).
  - `registry.json` — one routing-signal `origin` string (`"TSRX034"` →
    `"LTC034"`).
  All 22 components' `.server.ts`, `.client.ts` and `.css` are byte-identical.
- **Census unmoved:** 22 entries — 20 folded, 2 simulated, 0 static.
- **Compile-warning baseline unmoved:** 0.
- **Simulation build report unmoved:** 2 Simulated-tier components, 8
  occurrences across 2 locales, 0 unclassified.
- `bun test server/tests`: **1602 pass / 13 fail**, the 13 being pre-existing
  environment failures (6 `serve.test.ts` port-bind cases and the `watchFiles`
  debounce timing case), verified identical on the pre-sweep tree.
- `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.nosubstrate.json
  --noEmit`: clean apart from the pre-existing `form-combobox.spec.ts`
  `Element`-property errors.
- `bun run check:corpus`: same 5 pre-existing `form-spinbutton` TS2552
  diagnostics, same census, same baseline.
- `bun run build:docs`: green. `bun run check:links`: 496/496 resolve.
- `biome check ./server ./scripts ./src ./examples`: clean apart from a
  pre-existing unused-variable in `server/tests/effects/page-render.test.ts`.

## Outstanding

- **`.agents/skills/` was not updated** — the sandbox denies writes there.
  `.agents/skills/le-truc/references/errors.md`,
  `.agents/skills/le-truc-dev/references/non-obvious.md` and
  `.agents/skills/tech-writer/workflows/error-message-lifecycle.md` still spell
  the renamed codes `TSRX###`. **Now tracked as LT-272**, which also picks up the
  review finding that `server/compiler/diagnostics.ts` — the file owning the
  namespace — states the two-prefix rule nowhere, and the missing catalog rows
  for `LTC047`–`LTC050`.
- **Historical records left as written:** `adr/` bodies (ADR 0028 carries an
  amendment instead), `DONE.md`, `CHANGELOG.md`, `COMPILER_REFLECTION.md`,
  `COMPILER_REVIEW.md`. They record what was decided when, and rewriting a code
  name inside them would falsify the record. This ledger is the forward pointer.
- **`TODO.md` and `BACKLOG.md` were swept after all** (Architect, at the LT-271
  review). The sweep had grouped them with the records above; that was wrong —
  they are the open work queue, not a log, and 30 stale code names in open
  Tech Writer tasks (LT-189, LT-220, LT-251) would have pointed at codes that no
  longer exist. Both re-prefixed; the six kept codes untouched.
