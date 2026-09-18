# Compiler Review — `server/compiler/`

**Date:** 2026-09-18 · **Reviewer:** Architect · **Scope:** all 46 `.ts` files under `server/compiler/` (21,729 lines), read in full across three parallel exploration passes (front ends & lowering, shared analysis, back end & diagnostics & sim).

This is an observation-and-proposal document, not a plan of record. Nothing here is scheduled. When the owner picks items, they become `LT-222`+ tasks in [TODO.md](TODO.md) and — where they change a documented contract — ADRs.

---

## 0. Headline

The compiler is **not rotten — it is under-partitioned.** There are zero `TODO`/`FIXME`/`HACK`/`XXX` markers in 21.7k lines, only 15 `as any`/`as unknown` casts total, no `@ts-ignore`, no commented-out code, and a genuinely large test corpus (≈16k lines under `server/tests/compiler/`, including golden snapshots, a cross-surface parity suite, and a 2.6k-line diagnostics suite). Every design decision that looks odd has a prose comment explaining why, usually citing an LT number or ADR.

What has gone wrong is structural, and it is the predictable shape of many rounds of experimentation:

1. **Four functions hold a quarter of the compiler.** `runEffects` (1,538 lines), `diagnostic` (1,056), `emitServerModule` (993), `runHarvest` (628) plus `extractSetup` (470) = 4,685 lines in five declarations.
2. **The shared-machinery push (LT-202) sheared through the middle, not the ends.** `pipeline.ts`, `front-end.ts` and `lower-shared.ts` are genuinely shared. The two `compileSource*` drivers and the two `lowerFor`/`validateListBody` triples were copied instead, and **have already drifted — with one live user-visible bug**.
3. **Traversal is the dominant duplication.** Sixteen hand-rolled `TemplateNode` walks against a `walk.ts` whose stated job is to be the only one; eleven hand-rolled estree walks with five different skip-lists.
4. **Vocabulary is maintained by hand in parallel lists.** "Which names can the client resolve" is answered five times with five different exclusion sets. "Is this a signal read" is answered four times, subtly differently.
5. **Code generation is raw string concatenation with no shared builder**, and the escaping policy differs between the two emitters — which is where the four correctness findings in §1 come from.

The good news: because the test corpus is this strong, almost every proposal below is a **behaviour-preserving mechanical move verifiable by the existing golden/parity suites**. That is unusual and should be spent.

---

## 1. Correctness findings (fix these regardless of any refactor)

These are defects, not style. All four were independently verified against the source.

### 1.1 `.tsx` list-body diagnostic is always wrong — `frontend/tsx/lower-tsx.ts:637`

```ts
const offenders = [...dependenciesOf(node)].filter(name => !ctx.serverKnown.has(name))
return offenders
  ? `reads ${offenders.join(', ')}, which derive per item or client-side`
  : 'reads impure ambient state'
```

`offenders` is an **array**; an empty array is truthy. The `'reads impure ambient state'` arm is unreachable on `.tsx`, and an author hitting it gets `reads , which derive per item or client-side`. The `.tsrx` twin (`frontend/tsrx/lower-template.ts:646`) joins to a string first and is correct — this is a copy-paste drift introduced when the `.tsx` front end inlined the helper.

### 1.2 `first()` reason strings are injected unescaped into generated source — `emit-client.ts:332, 336, 267`

```ts
push(`const ${query.name} = first${typeArg}('${query.selector}', '${query.message}')`)
```

`query.message` is the author's `first(selector, reason)` second argument, carried verbatim by design (`analysis/naming.ts:66`). So:

```tsx
const input = first('input', "the user's name is required")
```

emits `first('input', 'the user's name is required')` — a syntax error in the generated client module, surfacing as an unmapped `tsc` failure on generated code rather than a diagnostic on the author's line. A backslash or `', evil(), '` is outright source injection into the build output.

`emit-server.ts` already uses `JSON.stringify` in the equivalent positions (570, 609, 613, 634). The two halves are inconsistent about the same hazard.

**Same class:** `observedAttributes` (`emit-client.ts:654`, `config.ts` validates literal-ness but not content), and ~15 further `'${…}'` sites in `emit-client.ts`.

### 1.3 Quoted class-map keys emit a dot access — `emit-client.ts:451`

```ts
`watch(() => Boolean(((${effect.thunkText})()).${key}), bindClass(${effect.query}, '${key}'))`
```

`class={() => ({ 'has-error': invalid })}` is legal TS and generates `(…).has-error` — a syntax error. Needs bracket access with a `jsString`'d key. (Second occurrence at `emit-client.ts:212`, the loop-body path.)

### 1.4 `analyzeClient` mutates its input and is not idempotent — `analysis/compose-refs.ts:118`

`resolveComposeRefs` does `target.attrs.push({ kind: 'ref', name: ref.name })` — it mutates the `ComponentIR`. A second `analyzeClient` over the same IR hits the `claimed` check at `compose-refs.ts:105` and emits a spurious `firstSelectorDuplicate`. The ordering contract that makes this work ("runs before the `refNames` walk below") is enforced by a comment at `analysis/plan.ts:470`, nothing else.

**Also worth a look:** `analysis/selectors.ts:291/317` (`allComposeNodes`, `composeNodesBySource`) omit `pendingChildren` from the `try` case, while `countForSelector` (`:197`) deliberately includes it. A compose site inside a `@pending` arm is therefore invisible to the duplicate-`id` check (`effects.ts:1629`). Unverified as reachable; worth a targeted test.

---

## 2. Structural observations

### 2.1 Five declarations hold 4,685 lines

| Declaration | Location | Lines | Natural seam |
| --- | --- | ---: | --- |
| `runEffects` | `analysis/effects.ts:110` | **1,538** | Its own comment bands: construct lowering (`232`–`607`), control-flow addressing (`657`–`1309`), compose (`1327`–`1393`), and a duplicate-compose-`id` *validation* (`1622`–`1647`) that shares nothing with effect planning. 22 nested closures all capturing `ctx` — passing `ctx` explicitly costs one parameter each. |
| `diagnostic` | `diagnostics.ts:128` | **1,056** | One object literal, 54 factories, in neither code nor alphabetical order (TSRX039 sits between 008 and 009; 044/045/046 between 012 and 014). |
| `emitServerModule` | `emit-server.ts:255` | **993** | The four closures `emit`/`emitElement`/`emitFor`/`emitListFor` are already lexically separate; they close over 7 variables. Lift an `EmitContext`, move them to module scope. Within `emit`, the async-boundary branch (`384`–`513`) and the compose branch (`547`–`639`) are standalone. |
| `runHarvest` | `analysis/harvest.ts:202` | **628** | Pass 2 (`240`–`378`) already produces a `Site[]` + `thunkRendered` that Pass 3 (`380`–`829`) consumes — the intermediate value exists, it just isn't a return type. |
| `extractSetup` | `front-end.ts:692` | **470** | 33 accumulators, one loop, ~8 disjoint statement classifications. The `expose()` block (`1026`–`1106`) alone is a self-contained `extractExpose`. |

Also over 120 lines: `emitClientModule` (427), `runLoops` (433 — two unrelated algorithms separated by a `// --- Pass 1b` banner), `createSimulationRealm` (494), `to-estree.ts:convert` (314), `classifyAttribute` (228), `analyzeClient` (232), plus ~12 more.

### 2.2 `front-end.ts` is six modules wearing one hat

Verbatim module scans (`197`–`417`) · params contract (`565`–`673`) · setup extraction (`692`–`1161`) · template-output resolution (`1233`–`1400`) · post-lowering validation (`1482`–`1601`) · IR assembly (`1610`–`1745`). Nothing in that list needs anything else in it except through `SetupExtraction`, so the split is mechanical.

`ast-utils.ts` has the same problem smaller: a ~420-line vocabulary-table module (17–438) and an AST-helper module (442–765) in one file, plus DOM knowledge (`DIRTY_FLAG_CONTROL_TAGS`) that is emitter business.

### 2.3 The two front ends copied rather than shared

`frontend/tsrx/compiler.ts:199` and `frontend/tsx/compiler-tsx.ts:106` are the same eight-step script. Step-for-step the only real differences are the setup slice, `decl.body.type`, and three message strings — the `async`-rejection message is a **200-character string duplicated verbatim**. The early-exit literal `return { component: null, diagnostics: ctx.diagnostics, routingSignals: ctx.routingSignals }` appears five times in each file.

Same pattern for `lowerFor`/`lowerListFor`/`validateListBody`: header parsing genuinely differs, everything after `itemName`/`iterableName` is one program. **Already drifted in three places:** the §1.1 bug; the `.tsrx` reserved-name check is `itemName === 'first' || keyName === 'first' || itemName === 'element'` while `.tsx` omits the `keyName` arm (`lower-tsx.ts:738`); and `.tsrx` rejects per-item `ref` attributes explicitly while `.tsx` falls through to a generic message.

The seam is a `SurfaceAdapter` — `{ componentBodyType, splitSetupAndOutput, stylesheetOf, outputShapeLabel, lowerChildren, lowerElement, preScans }` — plus a shared `runFrontEnd(ctx, ast, adapter)` in `front-end.ts`. Each `compileSource*` then becomes parse + adapter + call, ~40 lines.

Note that `SurfaceWording` (`lower-shared.ts:56`) already attempts this and covers **three strings** while ~30 other surface-specific fragments are inline literals at call sites. That is anti-drift theatre — it buys the appearance without the substance. Fold all of it in or drop the type.

### 2.4 Traversal is the dominant duplication

- **Sixteen hand-rolled `TemplateNode` walks.** `walk.ts:11` pre-authorizes some ("walks whose recursion is itself the SEMANTICS") but the authorized list is shorter than the actual list. Five copies of one exclusivity-aware `if/switch/try/element` cascade live in `selectors.ts` alone (`170`, `241`, `291`, `317`, `472`), each with slightly different `max`-vs-`sum` and pending-arm handling — which is where the latent bug in §1 sits.
- **Eleven hand-rolled estree walks** of the form `for (const [key, value] of Object.entries(node)) { if (key === 'loc' || 'range' || 'parent') continue; … }` — `front-end.ts:231/279/392`, `ast-utils.ts:668`, `frontend/tsrx/compiler.ts:185`, `evaluability.ts:231/505/574`, `reactivity.ts:197`, `tier.ts:259`, `harvest.ts:67/630`. Five different skip-lists: only `ast-utils.ts:675` skips type positions, so the others happily count identifiers inside `typeAnnotation`.
- **Scope logic forked from `freeIdentifiers`.** `reportLeTrucImportMismatch`'s inner `visit` (`front-end.ts:311`–`396`) re-implements `ast-utils.ts:521`–`690` and **lacks the `ForStatement`/`ForOfStatement`/`CatchClause` cases that `freeIdentifiers` later grew** — a known-fixed bug class never ported to the copy.

### 2.5 Vocabulary maintained by hand in parallel lists

- **"Names the client can resolve"** — five divergent implementations: `plan.ts:546` (9 exclusions), `loops.ts:98` (6, missing `plainLocalNames`/`clientLeTrucNames`/`isPending`), `loops.ts:384` (5), `harvest.ts:579` (5, different again), `plan.ts:614` (the inverse). The user-facing message string is copy-pasted six times.
- **"Is this a signal read"** — four subtly different answers: `harvest.ts:38`, `reactivity.ts:160`, `harvest.ts:163`, `ast-utils.ts:461`.
- **"Find an element's `ref` attr"** — six copies of `attrs.find(a => a.kind === 'ref')`, five with the same cast. `effects.ts:633` defines `refOf` and then hand-inlines it twice more in the same function (`983`, `1603`).
- **"Element has its own client construct"** — three versions, one of which (`loops.ts:194`) uses a hand-written kind list missing `style-map`, `pass`, reactive `html`, and `server`+`bindsProp`.
- **Ten overlapping name sets in `ast-utils.ts`**, with `REAL_EXPORT_NAMES` duplicating `SIGNAL_CONSTRUCTORS` and `PARSER_FACTORIES` entry-for-entry, and `MUTABLE_SIGNAL_CONSTRUCTORS` a hand-copied subset living in a *different file* (`front-end.ts:420`). Only `FACTORY_CONTEXT_MEMBER_NAMES` has a parity test.
- **The lazy-text emission gate** is ~70 lines cloned between `effects.ts:542` and `effects.ts:1483`, including two long diagnostic strings. The comment at `1519` records that the two have already drifted ("the nested path tolerates these silently — a pre-existing hazard there").

### 2.6 IR types discriminate on nullability instead of a tag

Three cases force casts and truthiness-dispatch across three passes:

- `ForIR.listSignal: string | null` (`ir.ts:376`) discriminates two entirely different lowerings; `hoisted`/`iterableName` are `each()`-only and `keyName`/`keyText` reconcile-only. Wants `ServerForIR | ReactiveForIR`.
- `try.pendingChildren: TemplateNode[] | null` (`ir.ts:175`) discriminates error boundary from async boundary; `handleAsyncBoundary` immediately casts it back (`effects.ts:1081`).
- `SignalIR.init` means different things per `constructor`, and `fallbackText` is `requestContext`-only. Every consumer special-cases by hand.

Plus: four parallel `first()` collections on `ComponentIR` (`refReasons`, `unmatchedOptionalRefs`, `deferredComposeRefs`, `optionalRefs` — a Map, two arrays of different shape, and a Set, all describing one construct); seven parallel `expose()` fields; overlapping `setup`/`plainSetup`/`clientSetup`/`signals` arrays whose own doc admits the redundancy. And `ExtractContext` (`ir.ts:626`) is front-end-only mutable state *with function members* living in a file whose header promises "no runtime values."

### 2.7 Cross-pass contracts are prose, not types

`AnalysisContext` (`plan.ts:389`) is one bag of mutable arrays and sets; nothing in its type says which pass fills which field. The contracts — loops-before-harvest, query registration order being byte-stable and load-bearing, `composeRegistry === undefined` silently disabling a whole pass, `ambiguousComposeNodes` as an "already reported" channel, `effects.ts` needing to agree with what `emit-server.ts` will fold — are all comments. Failure modes are silent: harvest reading an empty `forPlans` map is indistinguishable from "no loops," and produces a wrong *tier*, not an error.

The same shape one level down: `diagnostics: CompileDiagnostic[]` is threaded as a mutable out-parameter through 17 modules with 198 `push` sites.

### 2.8 Code generation has no shared builder

`emit-server.ts` defines `const tab = depth => '\t'.repeat(depth)` at line 313 and then interpolates `${tab(depth)}` roughly **60 times**, with every call site responsible for passing the right depth. `emit-client.ts:569`–`601` is 33 consecutive `append` calls with hand-managed depth and trailing commas written as string suffixes (`'},'`, `'})'`). Escaping is three different functions plus bare `JSON.stringify` plus raw interpolation.

`Part = { static } | { expr }` + `pushArgument` (`emit-server.ts:70`, `79`) is already the right data model — it is just private and used in half the places that emit markup. The three extractable concerns: a `CodeBuilder` (owns lines/depth/open/close, and makes the `cursor.offset +=` bookkeeping duplicated at `emit-client.ts:227/279/611` an invariant), a `jsString()`/`jsTemplate()` pair (the single sanctioned way to put an author string into generated source — closes §1.2 and §1.3), and an `HtmlWriter` generalising `Part[]`.

Related: `spans.ts:73`–`82` and `spans.ts:120`–`128` contain the same common-indent computation, copied, differing only in whether line 0 participates — a parameter, documented at length in both doc comments instead.

Related: the server emitter mints `__html`, `__arm${n}`, `__async${n}`, `__children${n}`, `__key` **with no collision check against author names**, while the client emitter has `uniqueName`/`usedNames` for exactly this. `retainReferenced` (`emit-server.ts:114`) does a token match against generated text, so an author const named `__html` would both shadow the buffer and confuse retention.

### 2.9 `diagnostics.ts`

One flat 1,056-line object. `(source, offset)` + `lineOf(source, offset)` is repeated **45 times** — the pair exists only to be converted at construction, and a `DiagnosticSite` would collapse two parameters and one call per factory. Inconsistencies:

- `invalidSource` (`192`) hard-codes `undefined` for the line, so every `export const i18n` error has **no line number** despite the offset being available.
- `formContextMismatch` (`1174`) takes `source: string` and never uses it.
- TSRX005/006/007/009 pass a caller-supplied `what` through as the whole message, so ~120 call sites author their own copy entirely outside this file's style. That is where message-style drift lives, and it is invisible to the tech-writer review this project's ADR 0028 process depends on.
- `TSRX031` is in the `DiagnosticCode` union with no factory and no other consumer — fully dead. `TSRX004`/`013`/`043` survive in the union only to document the spellings of `tier.ts:101`'s **separate** `origin` union. Meanwhile `TSRX020` was retired by deleting it and leaving a comment. Two treatments for the same situation in one file.

**Cheapest win in the file: sort by code, band-comment the groups.** `TSRX031` deletion and moving the three routing-signal origins into a named `RoutingSignalOrigin` in `tier.ts` are near-free.

### 2.10 Dead and vestigial surface

All verified by grep across `server/`:

| Item | Location |
| --- | --- |
| `duplicatedChannelArg` — zero callers; reimplemented inline at `first-refs.ts:310` | `reactivity.ts:90` |
| `QueryPlan.explicitType` — threaded through 5 signatures, set by nothing; its purpose was made moot by LT-086 | `plan.ts:59`, `naming.ts:40`, `emit-client.ts:322` |
| `parserImport` — an identity function used only as a truthiness test | `emit-client.ts:61` |
| `queryName` — returns its own argument in both branches; forces `queries` to be a parameter for nothing | `emit-client.ts:68` |
| `lineOf` imported, never used | `analysis/effects.ts:21` |
| `TopEffectPlan.async.okText` — only ever `true` | `plan.ts:343` |
| `ParserKind`'s `null` arm — never produced | `plan.ts:36` |
| Unreachable `AssignmentExpression` and `SequenceExpression` branches (shadowed by the binary-expression arm at `625`), making `flattenSequence` dead | `to-estree.ts:650`, `811`, `513` |
| `lowerComposeElement` exported, never imported | `frontend/tsx/lower-tsx.ts:874` |
| `PROTOTYPE_PATCHES` — empty array with a live 22-line applier and a re-export | `sim/patch-table.ts:287`, `realm.ts:482`, `index.ts:21` |
| `SIM_PATCH_TABLE` — only consumer is a test | `sim/patch-table.ts:370` |
| `returnTypeOfFunction`, `typeAnnotationForBinding`, `typeOfAnnotation` — exported, used only internally | `infer-type.ts:59/79/128` |
| `newerGrammarHint` — two-entry table, one entry (`await`) already rejected outright upstream | `frontend/tsrx/compiler.ts:81` |
| `indent.ts`'s module doc names `pushStatement`, which does not exist, and locates `reindent` in emit-server, where it no longer lives | `indent.ts:5` |
| Four stranded doc comments (a doc block sits above the *next* declaration's doc block, leaving its subject undocumented) | `ir.ts:51`, `reactivity.ts:54`, `first-refs.ts:416`, `effects.ts:1235` |
| `serverKnown` recomputed identically in two places; if they diverge, lowering and downstream silently disagree | `front-end.ts:1191` and `1660` |

Retired-spelling tombstones (`LEGACY_PASS_ATTR`, `LEGACY_HTML_ATTR`, the `&{expr}` sigil hook `onText` that exists solely to diagnose it) are a judgement call for a compiler that, in its own words, "has never shipped" — but note `onText` is the *only* reason `lowerChildrenSkeleton` has that seam at all.

### 2.11 Redundant work

Not a correctness issue at corpus scale, but it shapes how the passes read. Per `analyzeClient`: the compose walk runs twice (`compose-refs.ts:57`, `effects.ts:1629`); `countForSelector` is a full-template walk run once *per candidate selector*, i.e. 3–6 whole-template walks per element needing a query, from three different passes; `recordSites` rebuilds `component.signals.map(s => s.name)` four times per attribute (`harvest.ts:284/293/298/350`) and `[...component.fors.values()]` per element visited; `hostPropOf(attr.thunk)` is computed in four places. `addQuery` dedups the *result* by selector string but not the work.

### 2.12 `sim/` — the healthiest corner, with three notes

jsdom is imported in exactly one place (`realm.ts:89`) and `patch-table.ts` is genuinely declarative data. But: `SimulationRealm` names jsdom in its public type (`realm.ts:155`, `readonly window: JSDOM['window']`), so `index.ts:8`'s claim that substrate-swapping is confined to `realm.ts` plus the table is not quite true. `CAPABILITY_PATCHES` is a *classifier input* (read by `tier.ts`) wearing a patch-table costume and is never applied, while `SIM_PATCH_TABLE` claims to be "the whole table, in application order." And `createSimulationRealm` is process-owning (global `console` patching, an `unhandledRejection` handler) — a real constraint encoded only in prose and a `load()` throw.

---

## 3. Proposals

Ordered by leverage-per-risk. Every item in waves 1–3 is behaviour-preserving and verifiable by the existing golden + parity suites; wave 4 changes types, not behaviour.

### Wave 1 — Free (delete, or fix in isolation)

1. **Fix the four §1 defects.** 1.1 is two lines. 1.2/1.3 want the `jsString()` helper from wave 3 but can be point-fixed now. 1.4 is "return the attachments, apply once."
2. **Delete the §2.10 dead surface.** Nothing in that table has a consumer. `explicitType` alone removes a parameter from five signatures.
3. **`diagnostics.ts` hygiene:** sort by code, band-comment groups, delete `TSRX031`, move `TSRX004`/`013`/`043` into a named `RoutingSignalOrigin` in `tier.ts`, drop the unused `source` parameter, and give `invalidSource` its line number.
4. **Fix the four stranded doc comments and `indent.ts`'s stale module doc.**

### Wave 2 — Mechanical partitioning (no logic changes)

5. **Split `front-end.ts` into the six modules of §2.2.** This is the single highest-value move in the document: it makes `extractSetup` the only remaining monster in the front end and it is pure file surgery.
6. **Lift `emitServerModule`'s four closures to module scope behind an `EmitContext`.** Turns a 993-line function into ~6 units without changing a byte of output — the golden suite proves it.
7. **Split `runEffects` at its own comment bands**, extracting the duplicated lazy-text gate (removes ~70 cloned lines and one *documented* drift) and lifting the compose-`id` scan out as `validateComposeIds`.
8. **Split `runLoops` into `runEachLoops`/`runReconcileLoops`** and `runHarvest` into `collectRenderSites`/`planHarvests` — in both cases the boundary is already a comment banner and the intermediate value already exists.
9. **Split `ast-utils.ts` into `vocabulary.ts` + `ast-utils.ts`**; move `DIRTY_FLAG_CONTROL_TAGS` to the emitter side.

### Wave 3 — Collapse the duplication

10. **One `walkEstree(node, visit, { skip })`** replacing eleven copies, with one skip-list decision made once (including "do we descend into type positions" — currently answered five ways).
11. **Route the sixteen `TemplateNode` walks through `walk.ts`**, and narrow `walk.ts:11`'s authorized-exception list to what actually remains. This is where the `pendingChildren` inconsistency gets settled rather than re-litigated per call site.
12. **One `clientResolvableNames(ctx)` and one message factory**, replacing the five divergent lists and six copies of the string in §2.5. One `refOf`, one `isSignalRead`, one `hasOwnConstruct`.
13. **Derive the `ast-utils.ts` name subsets from their supersets** rather than re-listing them, and pull `MUTABLE_SIGNAL_CONSTRUCTORS` back beside `SIGNAL_CONSTRUCTORS`. Extend the `globals.test.ts` parity test to cover the rest.
14. **Introduce `SurfaceAdapter` + `runFrontEnd`** (§2.3) and collapse the two `compileSource*` and the two `lowerFor`/`validateListBody` triples. Fold `SurfaceWording` into one complete `SurfaceVocabulary` or delete it — the current three-string version is worse than nothing because it implies coverage it does not have.
15. **`CodeBuilder` + `jsString()` + `HtmlWriter`** shared by both emitters (§2.8). Removes ~60 `tab(depth)` interpolations, the three copied `cursor.offset` lines, and closes §1.2/§1.3 structurally rather than site-by-site. Give the server emitter the client's reserved-name policy while in there.
16. **Extract `commonIndent()`** shared by `reindent` and `appendWithSpans`.

### Wave 4 — Type-level (changes the IR contract)

17. **`ForIR`, `try.pendingChildren` and `SignalIR` become real discriminated unions** (§2.6). These three nullability-discriminants are what force the casts and the truthiness-dispatch across three passes; fixing them removes casts rather than adding them.
18. **Consolidate the four `first()` collections and the seven `expose()` fields** into one shape each.
19. **Move `ExtractContext` out of `ir.ts`** into the front-end module that owns it, restoring `ir.ts`'s stated "pure type leaf" property.
20. **Make the pass contracts typed** (§2.7): give each pass an input type naming what it requires and an output type naming what it produces, so "loops before harvest" is a type error rather than a silent wrong tier. This is the one item that is design work rather than refactoring, and it should be grilled before it is scheduled.

### Deliberately not proposed

- **Any rewrite.** The behaviour encoded here is the product — the rewrite rules *are* ADR 0024's consequences, and the prose comments are load-bearing institutional memory. Every proposal above preserves them.
- **Retiring the `.tsrx` surface to remove the duplication.** ADR 0032 rules dual surfaces and the parity suite is the standing contract. §2.3 is a case for *sharing more*, not for dropping one.
- **Caching/memoising the redundant traversals of §2.11.** At corpus scale this is not a measured problem, and a memo layer would add a second consistency contract to a codebase whose problem is already too many implicit contracts. Revisit only if build time becomes a complaint.
- **Restructuring `sim/`.** It is the healthiest corner; the three notes in §2.12 are documentation and type-surface fixes, not architecture.

---

## 4. Suggested sequencing

Waves 1 and 2 are independent of everything else in [TODO.md](TODO.md) and can be interleaved with feature work. Wave 3 item 14 (`SurfaceAdapter`) should land **before** the next surface-capability task, because every such task currently costs two edits and risks a fourth drift. Wave 4 should wait for a grilling session — item 20 in particular is a design question, not a cleanup.

No ADR is needed for waves 1–3: nothing there changes a documented decision. Wave 4 items 17–20 change the IR contract that `LE_TRUC_COMPILER.md` §4 documents, so they want an ADR and a tech-writer pass on that document.
