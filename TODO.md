# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-10-01): consolidate the compiler, then land the pre-publish
reshapes.** The previous iteration (the ICU MessageFormat switch) is landed and reviewed;
Changelog Keeper merged it into `CHANGELOG.md [Unreleased]` the same day and `DONE.md` was pruned.

**Why now (owner, 2026-10-01).** Three things converge. (1) LT-233 has landed, so the ADR 0037
work (LT-274–LT-276) and the ADR 0033 CSS track (LT-268 → LT-304/LT-306) no longer contend with
it for the front ends. With LT-287/LT-288 they are every remaining reshape that must land before
the first publish (ADR 0040). (2) The P2b consolidation keeps losing to feature work. The
compiler has grown from 46 modules / ~21.9k lines at the 2026-09-18 review to 69 / ~27.0k
(measured 2026-10-01, non-test `.ts` under `server/compiler/`). The suites (goldens, render and
diagnostic parity, tier census) now cover mechanical moves, and every month of growth makes
them dearer. (3) LT-257's interface has no design, and LT-274 would otherwise build the
`conditional` node against a shape template emission has not defined. ADR 0037's rider asks
for the representation "decided with the interface, not retrofitted".

**Ruling taken at planning (Architect, 2026-10-01): consolidation goes first where it touches
what the features touch.** A behaviour-preserving move is cheapest before a feature grows new
call sites in the code it moves. LT-230 centralizes the `TemplateNode` walks before LT-274 adds
a variant. LT-243 and LT-229 replace the estree plumbing before LT-274 edits both front ends.
LT-234 lands the `HtmlWriter` that LT-274's arm templates and LT-257's emitter write through.
LT-227 splits the passes that LT-289 retypes. Moves that touch nothing a feature touches run in
parallel.

**The chain.**
- **Design gate.** **LT-360** designs the target-emitter interface (LT-257's interface half)
  and records it as an ADR. It is architect work, so it runs alongside track A from day one.
  It gates LT-274.
- **A — consolidation (P2b).** ~~LT-364~~ (reviewed 2026-10-01; the sandbox-proof `serve.test.ts` landed first, so every later handoff runs the full server suite). ~~LT-228 → LT-229~~ (reviewed 2026-10-01) → LT-232. LT-366 → ~~LT-243~~ (reviewed 2026-10-01) → LT-367. LT-230. LT-227 → LT-289.
  LT-234 → LT-247. LT-231 and LT-244 unordered.
- **B — published IR (ADR 0040).** ~~LT-287~~ (reviewed 2026-10-01) and LT-288. Either may start at once; LT-287 lands
  before LT-274.
- **C — conditions (ADR 0037).** LT-274 after LT-360, LT-230, LT-243 and LT-287. Then LT-276,
  and LT-275 as the copy round. LT-275 also takes LT-359's copy, so there is one Tech Writer round.
- **D — scoped CSS (ADR 0033).** LT-268 → LT-304 + LT-306 (one landing) → LT-248. It touches
  `css.ts`, the config and the example sheets, not the front ends, so it runs in parallel from
  day one.
- **Parallel slot.** LT-245 (spike), LT-358, LT-361.

**Deliberately not here.** LT-257's build half, LT-254 and the rest of P1 stay behind P6, as
ruled 2026-09-19. LT-246 waits for the census format to settle after LT-274. LT-355 (a composed
child silently dropped from a reactive-list template) is a real bug, but it edits the same
template extraction as LT-274 and should follow it. LT-342, LT-352, LT-353, LT-356 and LT-281
stay in the backlog, and so does LT-305 (the baseline guard ships in 3.0 but is not a reshape).
LT-280 (per-item effect channels) is still architect work.

**Exit criterion.** Tier census and warning baseline unchanged from the iteration's opening
measurement (record it before the first change), except where LT-274, LT-276 or LT-304/LT-306
change them by design, as those tasks state. The mechanical tasks (track A, LT-287, LT-288)
leave goldens and parity byte-identical. The reflection's library swaps have landed
(`@typescript-eslint/typescript-estree`, `eslint-visitor-keys`, `magic-string`), and the net
line count of `server/compiler/` is recorded against the 27.0k baseline. An ADR fixes the
target-emitter interface, including how a reactive condition's prop-dependent initial state is
represented, and LT-274's `conditional` node carries that representation (LT-360). Reactive
conditions and the async boundary lower to template-cloned arms on both surfaces, with render
and diagnostic parity (LT-274, LT-276). Compiled sheets are shadow-root form, emitted scoped in
both `cssTargets` modes (LT-268, LT-304, LT-306). Every reshape ADR 0040 names as gating LT-254
has landed. `bun run build:docs` and `check:links` pass.

**Next free task ID: LT-368.** Next free diagnostic code: LTC059 (LTC056 is LT-358's; LTC057/LTC058 are LT-257's).

---

### Design gate

- [x] LT-360: Design the target-emitter interface for template emission — LT-257's interface half, decided before LT-274 builds the `conditional` node. — done, pending review ⏳ (2026-10-01: [ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md) accepted by the owner; `CONTEXT.md` gains Hole, Target Emitter, Escaping Context, Emittability; ADR 0034 s3 and ADR 0037 Related amended in place, both unpublished; LT-257 rewritten as the build half; LT-274 amended; the authored-`<script>` gap the session surfaced is a rider on LT-358.)
  **Skill:** architect (ADR via adr-keeper)
  **Context:** ADR 0034 s3/s4, M27. LT-257 says "decide the interface before writing the first
  emitter", and its ADR 0037 rider says the interface must represent a reactive condition's
  prop-dependent initial state. LT-274 is the first task that adds IR the emitter will read,
  so the interface is decided now and only the Twig build stays late. This is a grilling session
  with the owner, not an implementation task. It produces: an ADR (next free number); `CONTEXT.md`
  terms (hole, target emitter, escaping context, emittability); LT-257 re-scoped as the build
  half; and LT-274's IR requirement written into its entry.
  **Questions the session must close:**
  (1) **Hole grammar.** Is a hole only a bare server-arg read, or a closed expression subset
  (member access, `!`, literal equality, `&&`/`||`, ternary) that every target must translate?
  Is an arg expression outside the subset a tier 1 diagnostic, or does it make the component
  non-emittable with a census reason, parallel to the tiers? This decides whether emittability
  is per component (like tiers) or per expression (like unresolvability).
  (2) **Escaping contexts.** Settle the closed taxonomy the interface types, so a target cannot
  leave one unhandled: text, quoted attribute, URL attribute (does the `setAttribute`
  safe-protocol allowlist travel into the target?), boolean attribute, `class`/`style` maps,
  `truc:html` (refuse, or require a target-side sanitizer filter, given LT-138's fail-closed
  rule), and the always-refused positions (`<script>`, `<style>`, `on*`). Where does the
  refusal live: shared or per target?
  (3) **Conditions.** A static condition over args folds per render today; in a template it
  becomes a backend conditional. For a reactive condition (ADR 0037) the initial winner is
  prop-dependent: every arm is still emitted as an inert `<template>`, and the live winner is
  chosen by a backend conditional. What must LT-274's `conditional` node carry for that — the
  initial-condition expression in hole grammar, separate from the client thunk? What happens to a
  condition whose initial value reads a signal initializer that is not an arg?
  (4) **Loops and composition.** `@for` over server data becomes a target loop (with `@empty`).
  Does a composed child become a target include with an arg mapping, or is it inlined at compile
  time? That choice also decides the partial's file granularity.
  (5) **Locale.** One partial per locale, or one partial with a locale hole? Both are allowed
  by ADR 0034 s4. The blocker is an ICU message or `Intl` format over a server arg
  (`t.tasks({ count })` with `count` a prop): a template language cannot run it. Is that a
  refusal, a target-side formatter contract, or a hole that ships the preformatted value from
  the CMS?
  (6) **Harvest equivalence.** Holes must render exactly where the client harvests (ADR 0024
  s3). The check is: a target render with the same args is equivalent to the SSG fold (ADR 0029
  s7 discipline). Which reference renderer does CI run for Twig — `twig.js`, or PHP in CI?
  (7) **Which tiers emit.** Folded, yes. Simulated, no (ADR 0035). Static: a skeleton partial
  or nothing?
  (8) **The second trivial target** (a JSON/debug dump) that proves "a second target needs no
  reshaping of the first". Where does it live: tests only, or shipped?
  **Channel/tier:** the ADR assigns every refusal a channel and tier (an unescapable position is
  compiler, tier 1, per LT-257). New LTC codes are named; Tech Writer owns their copy in LT-257.
  **Check:** the ADR is accepted by the owner. LT-257 and LT-274 are amended. No question above
  is left "decide at implementation".

### A — Consolidation (P2b; LT-232 next — LT-364, LT-228/LT-229 reviewed, in DONE.md; LT-227 → LT-289; LT-234 → LT-247)

- [ ] LT-232: Derive the name-set subsets; extend the parity test.
  **Skill:** le-truc-dev
  **Context:** Review §2.5/§3 item 13. `REAL_EXPORT_NAMES` duplicates
  `SIGNAL_CONSTRUCTORS` and `PARSER_FACTORIES` entry-for-entry (its own comment admits
  "hand-maintained against the barrel"); `MUTABLE_SIGNAL_CONSTRUCTORS` is a hand-copied
  subset living in `setup-extraction.ts` (ex-`front-end.ts:427`, LT-224). Derive subsets from supersets; relocate the
  mutable set beside `SIGNAL_CONSTRUCTORS` (post-LT-228: into `vocabulary.ts`); extend
  `globals.test.ts`'s parity test (only `FACTORY_CONTEXT_MEMBER_NAMES` has one) to pin
  every set against the `@tsrx/core` barrel.
  **Verification:** typecheck; the extended parity test; goldens + parity
  byte-identical.

- [ ] LT-366: Replace the browser-bundle smoke with a source-level runtime-neutrality check over both front ends.
  **Skill:** le-truc-dev
  **Context:** Owner ruling 2026-10-01 (LT-243 design session): browser purity was only ever
  needed by the proposed playground. It belongs to [ADR 0025](adr/0025-client-side-component-playground.md)
  s6, which builds its own bundle gate if accepted. The compiler's standing rule is
  [ADR 0038](adr/0038-runtime-neutral-build-path.md) s2: `server/compiler/`'s own sources touch
  no `RuntimeIO`, no `Bun.*`, no `import.meta`-anchored path and no IO module. Portable
  `node:path` is allowed, and third-party dependencies are out of scope. The bundle smoke
  enforced a different, stronger property, and it had two holes: it bundled only the `.tsrx`
  entry, and `assertNodeFree` misses Bun's emitted `__require("node:…")`.
  **Do:** a test that scans every non-test `.ts` under `server/compiler/` (both front ends and
  the shared machinery) and fails on:
  - a `Bun` global read;
  - `import.meta` used for a path;
  - any `node:` (or bare built-in) specifier outside the allowlist `node:path` — static
    import, `require(…)` and dynamic `import(…)` alike.

  Use the existing estree walk rather than a regex, so `require`/`import()` in any form are
  seen. Move `server/compiler/smoke.ts` (a dev script using `node:fs`; its `ROOT` resolves
  above the repo) to `scripts/`, or delete it if `server-render-smoke.test.ts` covers it.

  Retire `scripts/build-tsrx-browser.ts`, `server/tests/compiler/browser-bundle.test.ts`, the
  `build:tsrx:browser` package script and `server/generated/tsrx-browser/`. Their
  Node/browser artifact-parity half goes with them; ADR 0025 s6 re-creates it.

  Sweep the comments that cite browser purity: `imports.ts` (header and the POSIX helpers —
  keep the helpers, restate the reason), `emit-paths.ts`, `ast-utils.ts`, `params.ts`,
  `corpus-config.ts`, `to-estree.ts`. In docs: `LE_TRUC_COMPILER.md` §7's purity gate and its
  "Browser purity is CI-pinned" line, and the `VOCABULARY_LEDGER.md` rows for
  `build:tsrx:browser` and `server/generated/tsrx-browser/`. Introduces no diagnostic code
  and no runtime check.
  **Check:** the check fails on a planted `Bun.file`, `import 'node:fs'`, `require('node:os')`
  and `import('node:child_process')` (fixture-level unit cases), and passes on the tree;
  `check:portability` green; server suite green; `check:links` green.

- [ ] LT-367: Move `to-estree.ts` onto typescript-estree's public `parse()` (LT-243 review follow-up).
  **Skill:** le-truc-dev
  **Context:** LT-243 imports `astConverter` from `@typescript-eslint/typescript-estree/use-at-your-own-risk`,
  with a cast over a partial `ParseSettings`. That entry was chosen only to dodge the package's
  load-time `node:` requires, and it didn't (both entries pull them). Under the 2026-10-01
  ruling (ADR 0038 s2) those requires don't matter, so the unstable entry and its cast buy
  nothing. Switch to `parse(source, { filePath, jsx: true, range: true, loc: false, comment:
  false, tokens: false })` — the API typescript-estree versions under semver. Keep the
  normalization pass and the LTC008 catch unchanged. The halted session's differential harness
  already ran on `parse()` with the same results. Update the module doc's API sentence.
  **Check:** `server/generated/components/` byte-identical; server suite green;
  `check:portability` green.

- [ ] LT-230: Route the sixteen `TemplateNode` walks through `walk.ts`; settle the `pendingChildren` policy once.
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 11. Sixteen hand-rolled template walks against a
  `walk.ts` whose authorized-exception list (`walk.ts:11`) is shorter than the actual
  list; five exclusivity-aware cascades in `analysis/selectors.ts` alone disagree on
  max-vs-sum and pending-arm handling — the soil the §1.4 adjacent gap grew in. Route
  them through `walk.ts` (keeping per-site aggregation semantics), narrow the
  authorized-exception list to what genuinely remains (walks whose recursion IS the
  semantics), and record ONE policy for `pendingChildren` arms, informed by LT-221's
  probe. **The five `analysis/selectors.ts` cascades ride LT-245's outcome**: a css-select
  GO replaces them wholesale (the library owns the traversal); a NO-GO keeps them here on
  the shared walk. Sequence after LT-245's ruling either way.
  **Verification:** goldens + parity byte-identical; the LT-221 probe still pins; full
  gates.

- [ ] LT-227: Split `runLoops` and `runHarvest` at their existing pass banners.
  **Skill:** le-truc-dev
  **Context:** Review §2.1. `runLoops` (433 lines) is two unrelated algorithms separated
  by a `// --- Pass 1b` banner → `runEachLoops`/`runReconcileLoops`. `runHarvest` (628)
  Pass 2 (~240–378) already produces the `Site[]` + `thunkRendered` that Pass 3 consumes
  — make it a return type: `collectRenderSites`/`planHarvests`.
  **Verification:** goldens + parity byte-identical; full gates green.

- [ ] LT-289: Typed pass contracts — functional passes over `PassShared` (LT-235 item (f); ADR 0040 s5).
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  s5 — the review's "one item that is design work rather than refactoring"; the design is now
  recorded, this task lands it. The order-carrying accumulators (queries, usedNames, ambient,
  childTags, refNames, diagnostics — byte-stable query order is their documented invariant)
  become an explicitly typed `PassShared` environment; each pass's productions become return
  values the next pass receives as REQUIRED parameters (`runLoops(shared) → LoopPlans`;
  `runHarvest(shared, loopPlans) → HarvestPlans`; `runEffects(shared, loopPlans, harvests) →
  EffectPlans`), so harvest-before-loops is a compile error in `analyzeClient` and "harvest
  read an empty `forPlans` map" is unrepresentable. `resolveComposeRefs` returns a typed
  `{ mode: 'resolved' | 'skipped' }` so a missing `composeRegistry` must be acknowledged;
  `ambiguousComposeNodes` stays the already-reported channel, carried on the resolved result.
  The `diagnostics` threading is deliberately untouched (ADR 0040's accepted tradeoff).
  LT-226's EffectsContext extraction is the structural pattern.
  **Check:** goldens + parity byte-identical; a harness calling `runHarvest` without
  `loopPlans` fails typecheck; `bun test server/tests`, typecheck, warning baseline 0.
  **Doc handoff (LT-235 review):** flip the LE_TRUC_COMPILER.md §4 pass-order passage from *target
  shape* to present tense in the same commit.

- [ ] LT-234: Shared code-generation kit — `CodeBuilder`, `jsString()`/`jsTemplate()`, `HtmlWriter`, `commonIndent()`.
  **Skill:** le-truc-dev
  **Context:** Review §2.8/§3 items 15–16. `emit-server.ts` interpolates `${tab(depth)}`
  ~60 times with every call site hand-managing depth; `emit-client.ts` runs 33
  consecutive `append` calls with trailing commas written as string suffixes; escaping is
  three functions plus bare `JSON.stringify` plus raw interpolation — the inconsistency
  behind §1.2/§1.3, which LT-221 point-fixed and this task closes structurally (migrate
  those point-fixes onto `jsString()`). Extract: a `CodeBuilder` owning
  lines/depth/open/close (making the three copied `cursor.offset` bookkeeping sites —
  `emit-client.ts:227/279/611` — an invariant); the `jsString`/`jsTemplate` pair as THE
  sanctioned way to put an author string into generated source; an `HtmlWriter`
  generalising the existing private `Part[]`/`pushArgument` model
  (`emit-server.ts:70/79`); and `commonIndent()` shared by `spans.ts`'s twin
  computations (differing only in whether line 0 participates — make it a parameter).
  Give the server emitter the client's reserved-name policy: it mints
  `__html`/`__arm${n}`/`__async${n}`/`__children${n}`/`__key` with no collision check
  against author names (an author `const __html` shadows the buffer and confuses
  `retainReferenced`'s token match). Channel/tier note (ADR 0028): compiler-internal
  naming policy — it renames, it does not error; no new runtime check, no new TSRX code.
  **Verification:** goldens byte-identical for the corpus (escaping output must not
  change for legal inputs); a pin that an author `__html` no longer collides; full gates
  green.

- [ ] LT-247: Adopt `magic-string` under `spans.ts` (reflection §5).
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table: replaces `spans.ts`'s hand bookkeeping (~−150 lines) and
  buys **real source maps free** — which M25's span-table remapping and the playground
  (ADR 0025, Proposed) both want eventually. Runs after LT-234 (which settles `CodeBuilder`
  and `commonIndent()` so this swap touches one settled surface, not two in-flight ones).
  **Demand note, stated so this doesn't jump the queue:** the payoff is contingent — source
  maps matter when editor/playground tooling consumes them, and ADR 0025 is Proposed. Do it
  when that demand arrives OR as a small output-neutral swap if it retires code without
  changing bytes; goldens byte-identical is the gate either way.
  **Verification:** goldens + parity byte-identical; the span table's remapped positions
  unchanged on a diagnostic-sample fixture; full gates.

- [ ] LT-231: Collapse the hand-maintained compiler vocabularies (review §2.5).
  **Skill:** le-truc-dev
  **Context:** Five divergent "names the client can resolve" lists (`analysis/plan.ts:546`;
  `analysis/loops.ts:98` — missing `plainLocalNames`/`clientLeTrucNames`/`isPending`;
  `loops.ts:384`; `analysis/harvest.ts:579`; the inverse at `plan.ts:614`) plus six
  copies of the user-facing message string; four subtly different "is this a signal read"
  answers (`harvest.ts:38`, `analysis/reactivity.ts:160`, `harvest.ts:163`,
  `ast-utils.ts:461`); `refOf` defined at `effects.ts:633` then hand-inlined at
  `:983`/`:1603`; three "element has its own client construct" versions, one
  (`loops.ts:194`) a hand-written kind list missing `style-map`/`pass`/reactive
  `html`/`server`+`bindsProp`. One function per question. Where convergence changes an
  answer (the `loops.ts` lists look like false-rejection bugs), the corpus must stay
  byte-identical and warning-0 — pin each converged answer on synthetic fixtures so the
  fix is visible. **Reflection §5 addition:** the `freeIdentifiers` fork (a scope-analysis
  fork that never received a known bug fix — it lacks the `ForStatement`/`ForOfStatement`/
  `CatchClause` cases the original grew; LT-229's walk migration fixes the *import-mismatch
  copy*, not this one) evaluates `@typescript-eslint/scope-manager`/`eslint-scope` (~−300
  lines, and a maintained scope manager cannot have that class of gap) against collapsing
  in-house — pick one in the handoff with the reasoning stated; a library adoption here is
  a reviewed dependency change per REQUIREMENTS §5, same as LT-243.
  **Verification:** goldens + parity byte-identical; warning baseline 0; census unchanged from the iteration baseline;
  synthetic pins for each converged answer.

- [ ] LT-244: Relocate `ExtractContext` out of `ir.ts` (LT-235 item (e); review §2.6/§3 item 19 — carved out of the design session).
  **Skill:** le-truc-dev
  **Context:** Reflection §6's "cheap way to keep the option," worth doing on its own merits and
  ahead of LT-235's full session. `ir.ts` is documented as a pure-type leaf — "a serializable
  `ComponentIR`" — and `ExtractContext` (front-end mutable state WITH function members) is the
  one violation. Evicting it (to `setup-extraction.ts` or its own module, beside its only
  consumers) restores the leaf property: the IR becomes a serializable data structure again,
  which preserves the native-rewrite option for free (reflection §6) and is a precondition for
  wave-4's type-level contracts treating the IR as data.
  **Verification:** typecheck (import moves); goldens + parity byte-identical; `ir.ts` imports
  no function-bearing front-end state (grep pin); full gates green.

### B — Published IR (ADR 0040; LT-287 before LT-274)

- [ ] LT-288: One `first()` record, two `expose()` shapes on `ComponentIR` (LT-235 item (d); ADR 0040 s4). **Gates LT-254** (ADR 0040, accepted 2026-09-24: a published IR type).
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  s4. The four parallel `first()` collections (`refReasons`, `unmatchedOptionalRefs`,
  `deferredComposeRefs`, `optionalRefs` — a Map, two differently-shaped arrays, a Set)
  consolidate into one `FirstRefDecl` (name, selector, required, reason, resolution stage,
  offset) in a name-keyed Map — the resolution stage is data, not a different shape. The seven
  `expose()` fields split into `expose: ExposeStmt | null` (text, range, argNode, ambients —
  four views of the one call) and one per-prop `ReadonlyMap<string, ExposePropDecl>` (kind,
  signalName?, parser?) — `exposeProps`/`exposeKinds`/`parserExposeProps` merge.
  `RegistryEntry.exposedProps` is a projection and unchanged. The
  `setup`/`plainSetup`/`clientSetup`/`signals` arrays stay as-is — ADR 0040's explicit
  exclusion (behavior-bearing emission contracts, not redundancy). Hottest consumer is
  `template-output.ts`; keep its lookups O(1) via the Map.
  **Check:** goldens + parity byte-identical; `bun test server/tests`, typecheck, warning
  baseline 0, census unchanged from the iteration baseline.

### C — Reactive conditions (ADR 0037; LT-274 after LT-360, LT-230, LT-243, LT-287)

- [ ] LT-274: Lower reactive conditions to template-cloned arms on both surfaces (ADR 0037 sub-designs 1–3 and 5). **Gates LT-254** (ADR 0040: the `conditional` `TemplateNode` variant must exist before the first publish). **Gated on LT-360** (the template-emission interface fixes how the node carries a prop-dependent initial condition) **and on LT-230, LT-243, LT-287** (consolidation first, so the new node lands in one walk and on the settled IR).
  **Skill:** le-truc-dev
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) (✅ Accepted 2026-09-26; ADR 0017's amendment already recorded). A condition that reads a signal — `@if`/`@else`, `.tsx` ternary/`&&`, IIFE switch, `@switch`/`@case` with literal cases — lowers to inert arm `<template>`s plus the server-folded initial winner rendered live, and client-side to `reconcile()` over the new **current-arm-key source** (`Signal<string | null>`; ADR 0017 amendment). Arm keys are the named compile-time constants (`then`/`else`, `case:<literal>`; sub-design 2). Arm effects mount under keyedScopes with collector parity. Static conditions are unchanged — the Folded tier still renders the single winner and omits the rest, so byte-identity across tiers holds. Reactive conditions inside reconcile containers stay banned (LT-186's rule).
  **Deliverable:** shared lowering in both front ends; arm extraction + initial-winner fold rules; the arm-key source form on `reconcile()`; diagnostics with channel/tier fields (dynamic `@case` value: compiler, tier 1 Prevented; reactive-if-in-reconcile-container: compiler, tier 1); goldens and parity extension.
  **Check:** byte-identical skeletons across all three tiers for reactive-if components; both-surface parity for renders *and* diagnostics; equivalence-audit pins refreshed (initial arm adoption is a new designed connect-diff class); M14 bundle budget re-measured; compile-warning baseline 0.
  **IR requirement (LT-360, [ADR 0043](adr/0043-the-target-emitter-interface-for-template-emission.md) s4):** one `conditional` node serves server-known and reactive conditions. It carries `mode: 'server' | 'reactive'`, the keyed arms, and an **initial winner** kept separate from the client thunk (the thunk stays a span only `emit-client` reads). The initial winner is one of three forms: `{ constant: key | null }`; `{ select: { when, key }[], otherwise: key | null }`, where `when` is a portable expression over server args (ADR 0043 s1); or a `fold` marker, meaning SSG folds through the value harness as today and a template target routes Static. Derive the initial expression by substituting signal initializers back to server args, sharing `fold-inputs`' analysis. A literal initializer, a `requestContext` fallback, or a Parser-backed `host.<prop>` read fed by a compose-site literal folds to `constant`. An unresolvable one gives no live arm (ADR 0037 s5). A non-portable one gives `fold`. SSG output is unchanged by this shape: goldens move only where ADR 0037 itself moves them. No template target consumes the node yet; LT-257 does.
  **Coordinate:** the IR node rides LT-235's discriminated-union session; the boundary switch is LT-276, sequenced after this; diagnostic copy is LT-275.

- [ ] LT-276: Switch the async boundary to template-cloned arms (ADR 0037 sub-design 4). (LT-303, its former sequencing gate, landed 2026-09-25.) **Gates LT-254** (ADR 0040).
  **Skill:** le-truc-dev
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md), owner ruling 2026-09-21: `@try`/`@pending`/`@catch` arms become templates plus the adopted winner, keyed `ok`/`nil`/`err`. Retires the fieldset wrappers `emit-server.ts` places at every arm root, the client's `hidden`+`disabled` sweep, and the LT-086 `.parentElement` addressing — all of it existed only because both arms were live simultaneously. The ok arm's resolved-value text and the err arm's bound catch-param text move into the per-arm mount. LT-211's no-stale-arm ruling and the `isPending` idiom are untouched; LT-078's tree-shaking question is re-pinned against templates. ADRs 0024 s13, 0032 s2 and 0041 already state the target mechanism; the teaching that still describes toggled arms (AGENTS.md's boundary bullet, `HOST_PROFILE.md`, the le-truc skill) flips with this task — Tech Writer rider.
  **Depends on** LT-274 (the mechanism).
  **Check:** every boundary-using corpus component's goldens refreshed; a form-submission negative test (named controls in non-active arms cannot submit — structural now, pinned anyway); audit pins; baseline 0.

- [ ] LT-275: Diagnostics lifecycle for reactive conditions — retire LTC005's signal-condition face; Tech Writer copy.
  **Skill:** tech-writer (drafting: le-truc-dev)
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) reverses "`@if` conditions cannot read signals" (`validateCondition`, `server/compiler/lower-shared.ts`). Only the **condition face** of LTC005 retires — the `t`-in-reactive-position face stays. The error-message lifecycle applies to every face touched: the LTC005 message, the arrow-thunk section's sentence in `server/compiler/HOST_PROFILE.md` and its "Open questions" reactivity paragraph ("creates no DOM outside declared lists", "Branch DOM lifetime … toggled via `hidden` (this host)"), and the teaching in ARCHITECTURE.md, AGENTS.md and the le-truc/cause-effect skills; the new ADR 0037 codes' final wording lands here. Batch with the LT-220/LT-189 copy rounds. **LT-233 rider (2026-09-25):** shared code words diagnostics only through `server/compiler/surface.ts` — each new ADR 0037 code's surface-specific fragments become `SurfaceWording` keys (both tables), and the `CONDITIONS` cases in `server/tests/compiler/tsx/diagnostic-parity.test.ts` flip to the new codes on both surfaces in the same change.
  **Check:** catalog rows added/retired match the diagnostics union; `check:links`; compile-warning baseline 0.
  **Depends on** LT-274.
  **Rider (LT-220/LT-189 review, 2026-10-01):** the ADR 0037 copy those rounds carried moves here — the HOST_PROFILE control-flow row, the arrow-thunk section's reversal, the ARCHITECTURE/AGENTS "`@if` cannot read signals" sentences, and the condition-face fix LT-189 now words as "show and hide the element with `hidden={() => …}`" (`lower-shared.ts` `validateCondition`).

- [ ] LT-359: LT-189/LT-220 review follow-ups — copy corrections.
  **Skill:** tech-writer
  **Context:** (a) `serverOnlyNames` says the read "would throw at connect". A handler throws
  when it runs, not at connect, so word the mechanism position-neutrally (e.g. "throws when the
  client runs it"), and update the parity pins. (b) CHANGELOG `[Unreleased]`'s ICU bullet
  says per-category keys and `truc:case` removal is a **Breaking change**. Neither shipped in
  a release (2.6.0 has no i18n), so drop the breaking-change clause. **Done 2026-10-01** by Changelog Keeper at iteration planning. (c) Compiler copy cites
  "ADR 0023" for the supported subset, composition (s10), config (s8) and async boundaries
  (s13), but `adr/0023` is the bind-helper map-form ADR. The compiler ADR was renumbered or
  purged in `9ccb22e1` ("ADR purge & alignment pass"). **Ruled (Architect, 2026-10-01): it is ADR 0024** — s8 config,
  s10 composition, s13 async boundaries, and the supported subset is ADR 0024 as a whole (s1). The
  section numbers already match; only the number is wrong. Sweep `diagnostics.ts`, the call sites, `errors.md` and the CHANGELOG
  line. (d) ADR 0028's inventory table: add LTC055 and the LTC053 loop-root case, via
  `adr-keeper`. (e) Carry LT-356's copy rider here.

### D — Scoped CSS (ADR 0033; LT-268 → LT-304 + LT-306 → LT-248)

- [ ] LT-268: Parse the authored stylesheet in the compiler — the `lightningcss` swap for `css.ts` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s9). **Ships in 3.0.** Prerequisite of LT-304, LT-214, LT-269, LT-270.
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** `server/compiler/css.ts` dedents and emits verbatim; the compiler holds **no
  model of the CSS at all**. `lightningcss` is **already a devDependency and already the
  build's CSS effect** (`server/effects/css.ts`). Parse the component's sheet and make its
  rules, selectors and at-rules reachable from the IR. **Spec-grammar validation of authored
  CSS (unknown property, invalid unit, malformed value) rides this swap**: channel compiler,
  **tier 1 Prevented** (ADR 0028 s1), since a malformed sheet has no correct emission.
  Evaluate `css-tree`'s `lexer.matchProperty` only where per-declaration diagnostics are
  wanted rather than a whole-sheet parse failure. This task adds the model and changes no
  output; the scoped emission and the `cssTargets` key are LT-304's.
  **Check:** emitted CSS stays **byte-identical** for every corpus component; a fixture with
  an invalid unit fails the build with the ruled copy; `check:portability` green with the
  dependency (ADR 0038 — it must run under every supported JS runtime; browser loadability is
  not required).

- [ ] LT-304: Scoped emission of shadow-root-form CSS — native `@scope` or the `:where(:not(…))` lowering, per `cssTargets` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s1–s7). **Ships in 3.0. Depends on LT-268; lands together with LT-306** (the corpus migration), since the old tag-led form becomes an error.
  **Skill:** le-truc-dev (Tech Writer owns the new LTC copy; LT-248 is the docs half)
  **Context:** Owner ruling 2026-09-24. A compiled sheet is authored as shadow-root CSS
  (`:host` plus bare selectors) and the compiler gives it shadow-root scoping in light DOM.
  (1) **`cssTargets`**: a browserslist-style key in `le-truc.config.json` (ADR 0036
  validation rules apply), default Baseline widely available, also fed to `lightningcss`'s
  own lowering. (2) **Boundary**: every custom-element tag the lowered template renders,
  composed and raw dashed tags alike. (3) **Native**: wrap the sheet in
  `@scope (my-element) to (<tag> > *, …)`, or `@scope (my-element)` for a leaf; emit
  `:host` as `:where(:scope)` and `:host(<sel>)` as `:where(:scope:is(<sel>))`; hoist
  `@keyframes`/`@font-face`/`@property` out unchanged. (4) **Lowered**: flat selectors led
  by the tag with a zero-specificity guard per boundary tag, e.g.
  `my-element .input:where(:not(my-element form-listbox > *, my-element form-listbox > * *))`,
  and `:host` as `:where(my-element)`. (5) **New tier 1 errors** (channel compiler, tier 1
  Prevented; next free LTC codes after LTC053): a rule led by the component's own tag
  (fix-it: `:host`), `::slotted()` in a light-DOM component, `:host-context()` anywhere
  (removed from the spec), and every `:global` form except the two whole-rule forms. (5a)
  **`:global`** (s6a): top-level `:global(<whole selector>) { … }` and `:global { … }`
  blocks are hoisted out of the scope verbatim; nested blocks, prefixed,
  trailing (fix-it: plain compound), leading-ancestor and mid-selector forms are the tier 1
  errors above, each with its own reason in the copy. (6)
  **Served CSS**: where a folder serves a compiled surface, the page imports the compiler's
  emitted CSS; the `.ts` twin's hand-written `.css` is served only with the twin (s10).
  **Check:** a fixture per contract point in s1/s3 compares the compiled light-DOM output
  with the same sheet inside a real shadow root: the host rule loses to a page type
  selector in both, and a parent rule never reaches a composed child's internals in
  either; a `:global` rule is emitted outside the scope in both modes; fixtures pin the s7 differences (inward reach, page-authored children, and the
  three lowering differences); the corpus Playwright specs pass once per mode (override
  `cssTargets`); each new error fires on its fixture; LTC051 still compares authored
  sheets; corpus warning baseline 0.

- [ ] LT-306: Migrate every compiled corpus stylesheet to the shadow-root form (ADR 0033 s2) and split the twins' CSS (s10). **Ships in 3.0. Lands together with LT-304.**
  **Skill:** le-truc-dev
  **Context:** Every compiled sheet (`.tsx` and `.tsrx`, both members of a variant set
  identically) moves from tag-led nesting (`my-element { … & .x { … } }`) to `:host { … }`
  plus bare rules, and drops the defensive `>` chains that only guarded against downward
  leakage, keeping a `>` where it expresses real intent (direct children only). Write it as
  a codemod over the parsed sheet (LT-268) rather than by hand, and keep it for pioneer
  projects. `module-dialog`'s `body.scroll-lock` becomes `:global(body.scroll-lock)`.
  The `.ts` twins' hand-written `.css` files stay tag-led and verbatim; point
  `examples/main.css` at the emitted CSS for every folder whose served surface is compiled.
  **Check:** the served pages render pixel-identically before and after where no leak was
  present (Playwright screenshot comparison per example, both CSS modes); LTC051 green
  across every variant set; no compiled sheet contains a rule led by its own tag.

- [ ] LT-248: Document compiled-component style scoping (ADR 0033, accepted 2026-09-24) where users read.
  **Skill:** tech-writer
  **Context:** Re-scoped by the ADR 0033 ruling: the doc obligation is no longer "scoped by
  tag name, a known limit" but the ruled model. `docs-src/pages/styling.md`'s compiled-component
  callout and `server/compiler/HOST_PROFILE.md` § Styles (including its selector-enforcement
  open question, now answered) state: a compiled sheet is shadow-root CSS (`:host` plus bare
  selectors), scoped in light DOM so rules stop at every custom element the template renders,
  emitted as native `@scope` or a `:where(:not(…))` lowering per `cssTargets`; host rules lose
  to page styles, as in a shadow root; defensive `>` chains are no longer needed; hand-written
  CSS for runtime-only components stays verbatim and tag-led. **Be plain that only a real
  shadow root gives inward encapsulation**: page CSS can still reach a light-DOM component's
  internals. Name every ADR 0033 s7 difference where an author would otherwise hit it, and
  list what switching to a shadow root changes beyond the stylesheet (s8). Also state the runtime
  baseline (Baseline 2023, REQUIREMENTS § Browser support) in the getting-started or
  installation page. **Lands with LT-304**, not before: until then the docs describe verbatim
  emission.
  **Verification:** `check:links` green; styling.md and HOST_PROFILE.md say the same thing in
  the same words (one is user-facing, one is the authoring profile).

### Parallel slot

- [ ] LT-245: Spike `css-select` + `parse5` for the structural-uniqueness proof; a real selector parser for `selector-syntax.ts` if the pattern holds.
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table, rank 4 — and the one wave-3 substitution that needs a spike
  before commitment. The structural-uniqueness proof (the moat: `first()` selector synthesis,
  exclusivity, cardinality) currently walks the IR/template by hand in five near-identical
  copies in `analysis/selectors.ts` (590 lines) that disagree on max-vs-sum and pending-arm
  handling (COMPILER_REVIEW §2.4; the soil LT-221's probe grew in). **Alternative shape: parse
  the markup the emitter itself produces** and query it with a real CSS engine (`css-select`;
  parse5 is already a dep) — the same question answered with far less machinery, dissolving the
  per-callsite re-litigation the hand walks cause. **Needs care, stated up front:** the proof is
  over the template INCLUDING unrendered branches, so branch arms must be materialized for the
  probe; and the proof reasons about constructs (compose sites, `@for` items) that have no
  DOM-bytes existence until render — the spike must show the materialized-probe model covers
  those before any GO. If the pattern holds, the same substitution covers
  `selector-syntax.ts` + `parseSimpleSelector`'s subset via `postcss-selector-parser`/`css-what`
  (~−250 lines) — the subset is currently the limiting factor on what `first()` can verify
  (descendant combinators, `:not()` are "cannot verify"); a real parser widens verification and
  shrinks code at once. Runtime neutrality (ADR 0038): the candidates must run under every
  supported JS runtime (`check:portability`); browser loadability is not required.
  **Deliverable:** spike findings + a GO/NO-GO ruling recorded here; if GO, implementation
  tasks with the per-site behavior-preservation discipline the other swaps carry.
  **Verification (spike):** the corpus's structural-uniqueness answers are reproduced
  identically for all 22 components (a differential harness: old walks vs materialized probe);
  goldens byte-identical; full gates.

- [ ] LT-358: LT-189 review follow-ups — coverage and signature gaps behind the reworded diagnostics.
  **Skill:** le-truc-dev
  **Context:** Three gaps in the LT-189 diff, none a copy question. (a) The `.tsx`
  `boundaryAsLoopRoot` guard in `frontend/tsx/lower-tsx.ts` (`lowerFor`) has no test. Pin it
  (block and expression bodies), and decide `.tsrx` parity: `@try` as an `@for` body root
  must get the same LTC053 rule, with a `diagnostic-parity.test.ts` case, or be recorded as
  intentionally surface-specific. (b) `formContextMismatch` (LTC050) receives no source offset,
  so the report has no line. Thread the annotation's offset in, as LTC049 now does. (c)
  `reportServerOnlyNames` routes a non-literal `i18n.t.<key>` read (the record spelling) to
  the generic "read the value through an exposed prop" fix, because the bad name is the
  record binding, not a `messageTBindings` entry. Route record-spelled `t` reads to the
  literal-key sentence too. Tier 1 throughout, compiler channel; copy stays Tech Writer's.
  **Rider (LT-360 session, owner, 2026-10-01):** (d) nothing refuses an authored `<script>`
  element today: it passes verbatim into served HTML, and no check in `server/compiler/` names
  it. Add a refusal on both surfaces, independent of template targets: **LTC056**, compiler
  channel, Prevented. It refuses every `<script>`, whatever its `type`, inside a component
  template; the page owns script loading. Add a `diagnostic-parity.test.ts` case. LTC057/LTC058
  are reserved for LT-257, so take LTC056 here. Copy goes to Tech Writer through LT-359's round.

- [ ] LT-361: Teach `sanitizeHtml` and the fail-closed `truc:html` default where users read (LT-138 handoff).
  **Skill:** tech-writer
  **Context:** LT-138 (reviewed 2026-10-01) added the public `sanitizeHtml(html)` export and made
  `truc:html` fail closed on both halves. Its docs handoff went to Tech Writer directly, with no
  task, and has not landed. Only `HOST_PROFILE.md` names `sanitizeHtml`. The CHANGELOG lines are
  done. Scope: a `sanitizeHtml` entry in `docs-src/pages/api.md` and its JSDoc in the API pass;
  the `truc:html` and security guidance states the fail-closed default and recommends DOMPurify
  on both halves (`createDOMPurify(new JSDOM('').window)` at build, plain DOMPurify in the
  browser); "configure once" means once per realm, because the build and the browser are
  separate module instances; hand-written `dangerouslyBindInnerHTML` keeps raw passthrough (ADR
  0010 s6). Align the `.agents/skills/le-truc` references and `HOST_PROFILE.md`'s `truc:html`
  bullet. Under a Trusted-Types CSP an unconfigured client throws at the sink, which is correct
  (ADR 0010 s4); say so where CSP is discussed.
  **Check:** `bun run build:docs`, `check:links`.
