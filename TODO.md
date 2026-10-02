# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-10-02): the corpus port and the pre-publish reshapes.** The
previous iteration (consolidate the compiler, then land the pre-publish reshapes: tracks A–D,
LT-227–LT-406) is landed and reviewed. Changelog Keeper recorded it in `CHANGELOG.md
[Unreleased]` the same day and `DONE.md` was pruned. Its line-count record: `server/compiler/`
measured 75 modules / ~30.4k lines on 2026-10-02 (non-test `.ts`), against the 27.0k baseline of
2026-10-01. The net +3.4k is mostly the scoped-CSS track (`css-scope.ts`, the stylesheet parse)
and the materialized probe; the library swaps retired less than they added.

**Why now (Architect, 2026-10-02).** The first publish sits behind the P6 cleanup round, and P6
sits behind the corpus port (ruled 2026-09-19). The corpus port is three migrations
(LT-109–LT-111) gated on one design, LT-280, which has waited since 2026-09-21. So LT-280 is the
critical path, and it opens from day one. Around it go the reshapes that must land before the
publish and are cheaper before the migrations add call sites: the IR leaves the contract
(LT-370, which also turns `check:contract` green again), diagnostics take their published
record (LT-371), root-is-host is enforced (LT-375), and each template expression carries its
reactivity class (LT-373). The last iteration's reviews left four silent miscompiles or drops
(LT-378, LT-387, LT-355, LT-391); a framework does not ship those, so they run here too.

**Rulings taken at planning (Architect, 2026-10-02).**
1. **The record shape before new producers.** LT-371 lands before any task that adds a
   diagnostic (LT-186, LT-353, LT-355, LT-374, LT-375), so every new producer is born with
   `location`. This is the previous iteration's rule (consolidation before the features that
   would grow call sites in it).
2. **Root-is-host before new `.tsx` sources.** LT-375 lands before LT-109–LT-111 and LT-390
   author or migrate a `.tsx` source, so no new fragment root has to be migrated twice.
3. **LT-373 before LT-387.** Both change the answer to "does this expression read a signal".
   Centralize first, then fix the alias and shadowing cases in the one place.
4. **LT-342 rides LT-280's session.** LT-280's design question 2 *is* LT-342 (the `.tsx` key
   spelling); one ruling answers both, and LT-342 is then implemented by whichever LT-280
   implementation task touches `surface.ts`.
5. **The corpus-port sweep is restated.** LT-111's "no `.ts` component files remain" predates
   ADR 0039, which keeps each `.ts` twin as a variant. The sweep's check is now: every example
   folder is served from a compiled surface, the twins remain as variants, and LT-014's
   trigger is discharged on that reading.
6. **`build:docs` is red at opening** (the module-lazyload canvas notices, NOTES.md LT-397
   session). LT-335 is the fix, not a classification entry, and it runs from day one, since the
   exit criterion needs `build:docs` green.

**The chain.**
- **Design gates (architect, day one).** LT-280 (per-item effect channels; owner grilling →
  ADR 0024 s5 / ADR 0032 amendments → implementation tasks written into this file; LT-342
  ruled with it). LT-334 (lazyload's boundary; its implementation task pairs with LT-390).
  LT-409 (the shadow-root departures session; re-scopes LT-405/LT-407/LT-408).
- **A — pre-publish reshapes.** LT-370 → LT-371 → LT-375 and LT-373 (in parallel) → LT-387.
- **B — correctness.** Day one: LT-378, LT-391, LT-392, LT-335, LT-356. After LT-371: LT-353,
  LT-355.
- **C — corpus port.** LT-280 → its implementation tasks → LT-109, LT-110, LT-111 (after LT-375,
  LT-374 and LT-186; LT-374 and LT-186 after LT-371). LT-110 is LT-165 step 7's corpus pin.
  LT-390 after LT-375 and LT-334's ruling.
- **D — CSS departures.** LT-409 → LT-405, LT-407, LT-408 as re-scoped (or struck).
- **Parallel slot (day one).** LT-305 (the Baseline 2023 guard, ships in 3.0), LT-277
  (docs-server-dev), LT-393 (comment-only sweep), LT-410 (the owner's `errors.md` rows).

**Deliberately not here.** LT-254, LT-257's build half, LT-259–LT-261 stay behind P6 (ruled
2026-09-19), and with them the D-32 (public entry points) and D-28 (`Try` in template targets)
design sessions. LT-381 changes the census and the warning baseline by design and needs the
owner's sign-off first. LT-246 waits for LT-109–LT-111 to settle the census. LT-363, LT-369,
LT-372 (after LT-371, post-publish-safe) and the P3/P4/P6 items stay in the backlog. LT-310 and
LT-311 are design work and wait for P6.

**Exit criterion.** Tier census and warning baseline unchanged from the iteration's opening
measurement (record it before the first change), except where LT-109–LT-111, LT-390 or an
LT-280/LT-409 ruling change them by design, as those tasks state; the warning baseline stays 0.
The mechanical tasks (LT-370, LT-371, LT-373, LT-375's migration half, LT-393) leave goldens
and parity byte-identical. Every example folder is served compiled, per ruling 5. ADRs record
LT-280's and LT-409's rulings. The IR is out of `contract.ts`, every diagnostic carries
`location` on both surfaces, and a fragment root fails LTC060. No silent miscompile from the
last iteration's reviews remains open (LT-378, LT-387, LT-355, LT-391). `check:contract`,
`bun run build:docs` and `check:links` pass. The net line count of `server/compiler/` is
recorded against the 30.4k opening measurement.

**Next free task ID: LT-411.** Next free diagnostic code: LTC072 (LTC071 is LT-399's; LTC070 is LT-304's; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Design gates

- [ ] LT-280: Per-item effect channels in reactive-list loops — the lowering covers text fill + events and nothing richer (LT-266 evidence). **Design first (grilling); gates the loop-heavy composite migrations LT-109/LT-110/LT-111.**
  **Skill:** architect (design + ADR) → le-truc-dev (implementation)
  **Context:** The LT-266 size-bet conversion drafted module-todo on `.tsx` in full and drove
  it through the compiler until it hit structural walls; the evidence and full analysis are
  pinned in [spike/size-bet/FINDING.md](spike/size-bet/FINDING.md) § "The TSX conversion
  attempt". The `ReconcilePlan`/`emitReconcileBlock` reactive-list lowering emits a per-item
  text fill (`watch(item, bindText(…))`, bare `{item}` only) plus event listeners — no
  per-item `truc:pass` (the composite children's `checked`/`value` wiring), no per-item
  reactive attribute (the reorder button's `disabled`), no per-item id/`for`, and a
  non-string item renders as `[object Object]` (module-todo's items are store-backed
  `createStore` objects). Composed children inside reactive-list bodies have no per-item arg
  channel at all (ADR 0024 sub-design 5). The same walls stand on `.tsrx` — this is a
  capability gap in the shared lowering, not a surface gap, and the module-list shape is the
  only loop it fully covers today.
  **Design questions to rule, not to skip:** (1) which per-item channels the lowering earns —
  pass, reactive attribute, id/`for`, composed-child args — and their reconcile semantics
  alongside the existing text fill; (2) the `.tsx` key spelling (`keyName` is hard-coded
  `null` on `.tsx`, `frontend/tsx/lower-tsx.ts` — a `.tsrx` `key k` loop has no `.tsx`
  spelling; ADR 0032 parity gap, related to the keyName grammar-asymmetry ruling LT-221
  recorded); (3) whether non-string item fills stay out of scope — if so that is a
  **silent-trap fix: channel = compiler, tier 1 Prevented** (today it misrenders as
  `[object Object]` with no diagnostic); (4) module-todo's own fate — hand-authored today by
  LT-266's ruling, but under LT-238's three-spelling showcase the flagship composite without
  a `.tsx` spelling is a standing hole in the product story, so the ruling must say which
  spellings module-todo carries when this lands. Coordinate with LT-274 (template-cloned-arm
  machinery may share extraction/addressing vocabulary; both touch the reconcile container),
  LT-242 (any new diagnostic must diagnose identically on both surfaces from day one).
  **Obligations:** the rulings amend ADR 0024 sub-design 5 and likely ADR 0032 (key
  spelling, equivalence scope) — record via `adr-keeper`, do not edit in place. Any new
  diagnostic names **Tech Writer as copy reviewer** (developer drafts; Tech Writer owns
  final wording) and enters the catalog per the error-message lifecycle.
  **Verification:** the design ruling recorded (ADR + task split if implementation is more
  than one change); module-todo (or the design's chosen flagship probe) compiles on the
  sanctioned subset with per-item wiring surviving hydration; parity suite extended;
  `bun test server/tests`, typecheck, warning baseline 0.

- [ ] LT-342: A `.tsx` spelling for the reactive-list key binding — capability parity (ADR 0032 s6), found by the LT-233 review.
  **Skill:** architect (design), then le-truc-dev
  **Context:** `.tsrx` binds the item key in the loop header (`@for (const item of items; key k)`)
  and a per-item handler acts through it (`items.remove(k)`) — form-tokenbox and module-list do.
  `.tsx`'s `.map()` has no spelling: an index parameter over a List is LTC005 (keyed
  reconciliation), a handler reading `item` is LTC005 (bindItem hands it a Signal), and
  `surface.ts` `listItemHandlerFix` is therefore empty on `.tsx`. So a `.tsx` reactive list
  cannot carry an item-scoped action at all. ADR 0032 s6 requires every capability to be
  expressed in both surfaces; this one predates the rule and was never paid for. Latent today
  (no `.tsx` corpus component declares a `createList`), live the moment either list component
  gets a `.tsx` variant.
  **Design first — options to weigh:** (a) the `.map()` callback's second parameter is the KEY
  over a declared List (host-profile typing must make `(item, key)` honest where Array's is
  `(item, index)` — check what `items.map` currently types as under `host-profile.d.ts`);
  (b) a key read inside the handler from the item signal (`item.key`?) — a cause-effect
  question first; (c) a `truc:` intrinsic only if (a) and (b) both misstate the meaning (ADR
  0041's bar). Whichever wins: the reserved-name check (`loopBindings`) and
  `listItemHandlerFix`/`listHandlerNames` in `surface.ts` gain the `.tsx` spelling, and a
  diagnostic-parity case pins the handler fix-it on both surfaces.
  **Channel/tier:** compiler, tier 1 (the shapes stay statically decidable).
  **Gates:** the first `.tsx` variant of form-tokenbox or module-list.

- [ ] LT-334: An async boundary lazyload can be spelled in (LT-104 review). **Gated by LT-276 (ADR 0037's template-cloned arms).**
  **Skill:** architect → le-truc-dev
  **Context:** The owner kept lazyload's hand-written `watch(content, { ok, nil, stale, err })`
  (2026-09-25), because the compiled `<truc:try>` misses its contract four ways:
  1. an escaped `textContent` ok arm where lazyload needs sanitized HTML with `allow-scripts`;
  2. fieldset-wrapped arm roots that page-authored instances do not carry;
  3. three sibling roots where loading and error share one `card-callout` (`.danger` on error);
  4. no ok-arm side effect (the scroll to the first heading on a later load).
  ADR 0037's template-cloned arms retire (2) outright, and change what (3) means. So the design
  waits for LT-276. **Design questions:** a `truc:html` ok arm (the value is the task's result,
  routed through the same sanitizer and `allowScripts` config `dangerouslyBindInnerHTML` takes);
  arms that share a wrapper element (named arm keys inside one parent, which ADR 0037's keyed
  arms may already allow); and whether an ok-arm side effect belongs in the boundary at all or
  stays a `watch` beside it (the `isPending` idiom's precedent says beside). Decide, then write
  the implementation task. The exit clause "lazyload's boundary is spelled `<truc:try>`"
  moves here.

- [ ] LT-409: Design session — the departures of compiled CSS from a real shadow root (ADR 0033 s7 as a whole; re-scopes LT-405, LT-407, LT-408).
  **Skill:** architect (with the owner; ADR 0033 amendment through adr-keeper)
  **Context:** The owner's ruling and the facts the session starts from, moved from the
  BACKLOG.md P2b preamble:
  **[2026-10-02, owner: LT-405 rolled back; LT-407 and LT-408 deferred from the current iteration's track D.]** All three explain or police a way compiled CSS departs from a real shadow root. The owner wants those departures re-evaluated in a design session (architect) before more of them are documented or given diagnostics: "the differences to real Shadow DOM become a burden that is increasingly hard to explain." The session reviews ADR 0033 s7's list as a whole (zero-specificity `:host(…)`, template-authored content inside a composed child, the LTC070/LTC071 refusals) and decides, for each, whether to keep it, close the gap in the emission, or reshape it. Re-scope all three from the session's outcome before picking any up.

  **Known state after the rollback (2026-10-02, measured by le-truc-dev).** These are the input facts for the session.
  - `:host { &:hover/&.x/&[open] { … } }` (and `:host(.a) { &:hover }`) gets no diagnostic. It emits exactly what the flat `:host:hover` would, `:where(my-box):hover` lowered and `:where(:scope):hover` native. That styles the host, where a shadow root matches nothing (`:host` is featureless; spec reasoning, not browser-checked).
  - The qualifier carries (0,1,0), so a page `my-box { … }` rule loses to it. That makes `styling.md:74` / `HOST_PROFILE.md:76` ("Page styles still win over `:host` rules") and § Differences' "behaves like the same sheet in a shadow root, except where …" overclaim for this form.
  - In lowered mode with boundaries, the nested form picks up the self-nesting guard, which `:host(X)` does not.
  - The corpus relies on the nested form at about 37 sites in 14 sources.
  - `:host(X)` still emits at (0,0,0), arguments included (LT-408's difference, undocumented).
  **Deliverable:** for each s7 difference — zero-specificity `:host(…)`, the nested
  `&<qualifier>` in `:host { }`, template-authored content inside a composed child, the
  LTC070/LTC071 refusals — a ruling: keep (and document once), close the gap in the emission,
  or reshape the authored form. Amend ADR 0033 s7 in place (unpublished). Then rewrite LT-405,
  LT-407 and LT-408 from the outcome (or strike them), naming channel and tier for any check
  that returns (ADR 0028). A ruling that changes emission changes goldens and pixels by design:
  say so in the rewritten task and require LT-397's pixel-parity procedure.
  **Channel/tier:** decided per difference by the session.

### A — Pre-publish reshapes (LT-370 → LT-371 → LT-375 ∥ LT-373 → LT-387)

- [ ] LT-370: Take the IR out of the public contract (D-25).
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s8 now says the IR is the lowering, internal, and may change in any
  release; ADR 0040's reshapes no longer gate the publish. `contract.ts` still exports
  `compileFromIR`, the IR types, `AstNode` and `SourceSpan`, and `contract.test.ts` plus the
  `check:contract` toy front end exercise that IR-level seam (ADR 0032 s6 replaced it with the
  source-to-source adapter seam, LT-376). Remove the IR types and `compileFromIR` from the
  contract; move the toy front end's coverage to an internal test or retire it. **Leave
  everything else in `contract.ts` as it is** — which entry points and result types are public
  is the D-32 design session's call, not this task's.
  **Docs:** `LE_TRUC_COMPILER.md` §2's published set and stability policy (the IR-union
  clauses) follow; Tech Writer reviews.
  **Channel/tier:** none — no check is added or retired.
  **Note (LT-268 review, 2026-10-02):** the toy IR literal in `scripts/contract-check.ts`
  predates LT-287/LT-288 (`exposeText`/`exposeKinds`/`refReasons`) and `check:contract` is red
  at HEAD. Retiring or moving the toy here discharges it; don't refresh it separately.
  **Verification:** `check:contract` and the full gates; goldens byte-identical.

- [ ] LT-371: Give diagnostics their published record shape (D-30, ADR 0044 s1–s2).
  **Skill:** le-truc-dev
  **Context:** `CompileDiagnostic` is `{ code, severity, message, line? }`
  (`server/compiler/diagnostics.ts`). ADR 0044 fixes the published shape: `location`
  `{ file, start, end }`, `related` locations, and an optional `fix` `{ description, edits }`
  where a repair needs no author judgement. Replace `line` with `location` at every producer
  (LT-358(b) already threads an offset for LTC050; extend that, do not special-case it), and map
  generated-module positions back through the span table. `RoutingSignal.line` follows the same
  shape. Attach `fix` only where safe — LT-134's fix-it wording is a candidate input, not a
  mandate. Must land before the first publish: replacing `line` afterwards is a major.
  **Channel/tier:** none added; every existing rule keeps its code and tier. Message copy is
  unchanged, so no Tech Writer round unless a message is reworded.
  **Verification:** diagnostic parity on both surfaces with ranges; a pin per producer family
  that `start`/`end` cover the offending construct; full gates.

- [ ] LT-375: Enforce root-is-host and migrate the fragment-root `.tsx` sources (D-07).
  **Skill:** le-truc-dev
  **Context:** owner ruling 2026-09-29, recorded in ADR 0032 s1 and `HOST_PROFILE.md`: the
  template's root is the host element, there is no fragment root, and `<style>` is a child of
  the root. 16 of 17 corpus `.tsx` sources still wrap the root and its `<style>` in a fragment.
  Migrate them (mechanical: move `<style>` inside the root, drop the fragment) and then make the
  fragment root a compile error naming the fix. Check what `.tsrx` accepts and give it the same
  answer (ADR 0032 s6 parity; D-04 is parked, so `.tsrx` stays first-class). LT-306 also rewrites
  every corpus sheet; land together or one right after the other, not interleaved.
  **Channel/tier:** compiler, tier 1 Prevented (LTC060). Runtime: none (a source shape). Tech
  Writer owns the copy.
  **Verification:** goldens byte-identical across the migration (the fragment never reached the
  output); the new rule's fixture; diagnostic parity; full gates.

- [ ] LT-373: Annotate every template expression with its reactivity class (D-26, ADR 0040 s7).
  **Skill:** le-truc-dev
  **Context:** today the class is derived in several places — `AttributeIR` carries
  `static`/`server`/`reactive`, a text child carries a boolean `lazy` decided by `reactivity.ts`,
  and the emitters re-ask. ADR 0040 s7: lowering classifies each attribute value and text child
  once, by ADR 0024 s4's rule (function-valued attribute → reactive; a text child by what it
  reads), and records its dependency closure (signals, `host.<prop>` reads, server args). The
  emitters, the tier classifier and LT-257's hole classifier read it. Build on LT-231's single
  "is this a signal read" answer. Behaviour-preserving.
  **Sequencing:** before LT-257's shared walk, which would otherwise grow a fourth derivation.
  **Channel/tier:** none.
  **Verification:** goldens, render and diagnostic parity byte-identical; the tier census
  unchanged; full gates.

- [ ] LT-387: Reactive-condition mode classification follows scope (LT-274 review).
  **Skill:** le-truc-dev
  **Context:** `validateCondition` (`lower-shared.ts`) goes reactive only when a free name is a
  signal or `host`. An alias — `const isOpen = () => open.get(); @if (isOpen())`,
  `const o = open; @if (o.get())` — compiles silently as `mode: 'server'` and never updates,
  against the documented contract; conversely a `@for` binding that shadows a signal name
  (`@for (const open of items) { @if (open) … }`) is classified reactive and refused.
  Resolve setup aliases to their signal (or refuse the read, tier 1 Prevented) and make
  `freeIdentifiers` scope-aware. Ride-along: `check:contract`'s scratch front end crashes in
  `analyzeClient` on an undefined `component.firstRefs` (fails on HEAD before LT-274 too).

### B — Correctness

- [ ] LT-378: The `@if` branch signature ignores which prop a prop-bound attribute binds (LT-368 review).
  **Skill:** le-truc-dev
  **Context:** `constructSignatureOf` (`analysis/effects.ts`) keys each client-construct attribute
  as `bind:<name>=<text>`, but takes text only from `event`, `reactive`, `class-map` and
  `style-map` attributes. A `server` attribute with `bindsProp` (LT-122), a `pass` attribute and a
  reactive `html` attribute all contribute an empty text. So two branch roots that bind
  *different* props to the same attribute compare equal and are union-addressed. Reproduced
  2026-10-01 in `.tsrx`: `@if (flag) { <p class="msg" title={label} …> } @else { <p class="msg"
  title={desc} …> }` compiles with no diagnostic to one `watch(() => host.label,
  bindAttribute(p, 'title'))`, so the `@else` root shows `label`. This is a silent miscompile; it
  predates LT-231. Fix: give each of the three kinds its distinguishing text (`bindsProp`, the pass
  entries' text, the html value text). Unequal signatures then route to per-branch addressing,
  which already raises LTC007 when the roots cannot be told apart. Pin it in
  `converged-answers.test.ts` beside LT-368's pins, on both surfaces (the `.tsx` ternary).
  **Channel/tier:** none added; LTC007 (compiler, tier 1 Prevented) now fires where it should.
  **Verification:** the pin fails with the fix reverted; corpus byte-identical; diagnostic parity;
  full gates.

- [ ] LT-391: An arm kind for `SuppressedSite` (ADR 0037 s5 under the Simulated tier).
  **Skill:** le-truc-dev
  **Context:** LT-274 review. A reactive test over the wall clock or RNG (ADR 0029 limb b)
  correctly renders no live arm, but when the component is Simulated for another reason the
  realm's connect clones an arm into the served HTML. Record suppressed arm sets and strip
  the realm-cloned arm before serialization, as other limb-(b) sites are.

- [ ] LT-392: Regenerate the declared types and gate an arm-set client against them (LT-385 review finding).
  **Skill:** le-truc-dev
  **Context (updated 2026-10-02, LT-386):** the REGENERATION half already landed — commit
  3ed0814b refreshed `index.js` (the committed bundle predated LT-274's `reconcile` arm form)
  and `types/src/helpers/reactive.d.ts` (the arm-form JSDoc). What remains is the GATE half:
  `types/` (the published `types/index.d.ts` graph) is a build artifact last
  regenerated at LT-361 — it declares only `reconcile()`'s two list-form overloads, so
  LT-274's arm form is absent from the declared surface. No corpus component emits an
  arm-set client, so `client.golden.test.ts`'s emit-then-check never exercised one; the
  first ever (LT-385's (g) fixture, `createCell(mode === 'wide')` over a `data-mode` DOM
  site) fails the golden tsc invocation with "Overload 1 of 2" — the arm-form overload does
  not resolve against the declared types. LT-389 already owns regenerating
  `types/src/helpers/reactive.d.ts` as a docs deliverable; this task adds the missing GATE
  so the declared surface cannot drift from the emitted clients again: regenerate `types/`
  from the current sources, then pin an emit-then-check of an arm-set client (the (g)
  fixture is the candidate) in the same shape as `client.golden`'s, so it runs on every
  suite pass rather than only when a docs build happens to refresh the artifact.
  **Check:** the arm-set client typechecks against the regenerated declared types under
  the golden invocation; `check:contract` stays green; run the full `build` to regenerate
  `types/` and diff for any other stale-surface drift landing in the same pass.

- [ ] LT-335: The simulation realm attributes a composed child's late work to the next component (LT-105 review).
  **Skill:** le-truc-dev
  **Context:** In the sim-driver's shared realm, module-coloreditor's composed form-colorgraph
  draws after its render window closes. The `getContext` notice then lands on
  **module-colorinfo**, which has no canvas. `realm.ts` § Attribution documents late reports
  going to the most recent window, but that case is a late *rejection* after the last render.
  This one blames an innocent component whenever a composite renders before a leaf. The
  `module-colorinfo` entry in `sim/classifications.ts` is a workaround that masks this.
  **Fix direction:** drain the composed closure's scheduled work (rAF, `schedule()`) before a
  window closes, so it attributes to its own render. Falling back to tagging each diagnostic
  with its originating element's host tag is acceptable if draining is not possible.
  **Channel/tier:** none.
  **Check:** the `module-colorinfo` canvas classification is retired, and the baseline test
  stays green with it gone.

- [ ] LT-356: An unparseable or non-object catalog FILE is silent in the census and destroyed by `i18n:sync` (LT-249 review).
  **Skill:** docs-server-dev
  **Context:** LT-249 made non-string catalog VALUES loud. The file-level sibling is worse.
  If `i18n/<locale>.json` fails `JSON.parse` (a trailing comma, a merge-conflict marker) or
  its top level is not an object, `readCatalogs` (`readJson` → `undefined` → `asRecord` →
  `{}`) treats the locale as empty. The census then reports every declared key `missing`,
  which is loud but wrongly attributed. `scripts/i18n-sync.ts` does the same (`catch {
  catalog = {} }`) and then **overwrites the file** with empty placeholders, so a
  translator's whole catalog is destroyed by one syntax error. **Channel and tier (ADR 0028
  s1):** the census stays a report (the build never fails on catalog data). Sync, the one
  writer, must refuse: an unreadable catalog aborts the sync for that locale, names the file
  and the parse error, and writes nothing to it or to its manifest entries. **How:** make
  `readCatalogs` distinguish "absent" from "unreadable" (for example a per-locale
  `unreadable: string` error), and have the census record it once per locale instead of N
  `missing` records (new status or a `malformed` record on the file; decide at pickup).
  Sync reads through the same path instead of its own `JSON.parse`. **Acceptance:** a
  scratch catalog with a trailing comma yields one census record, not N `missing`; sync
  leaves the file byte-identical and exits non-zero naming it; committed catalogs are
  unaffected. **Copy:** Tech Writer (batch with LT-189 item 8 if still open).

- [ ] LT-353: Reject unrecognized `truc:`-namespaced attributes at classification, on both surfaces (LT-251 review).
  **Skill:** le-truc-dev
  **Context:** `truc:` is the host-owned attribute namespace (LT-128), but
  `classify-attributes.ts` recognizes names one by one (`truc:pass`, `truc:html`) and lets
  anything else fall through to the ordinary static/server arms. So a retired `truc:case`, or
  a typo like `truc:htm`, renders as a literal attribute the browser ignores: silently wrong.
  That is the same failure LT-222 closed for `class:`. In `.tsx` a tsc error covers authored
  names, but the compiler itself still accepts them, so the two surfaces diagnose differently
  (the LT-242 parity bar). After the recognized names, reject any other `truc:*` name as
  LTC006 (malformed or unsupported attribute shape). Name the known vocabulary in the message,
  and give a retired name (`truc:case`/`truc:case-type`) a pointer to the ICU pattern
  replacement (ADR 0030 s4). **Channel:** compiler. **Tier:** 1 Prevented (statically
  decidable, no runtime half). **Copy:** the developer drafts it and Tech Writer owns the
  final wording (error-message lifecycle). Batch it into LT-189 if that round is still open.
  **Check:** add a `diagnostic-parity.test.ts` row for a `truc:bogus` attribute on both
  surfaces; the corpus stays warning-free.

- [ ] LT-355: A composed child inside a reactive-list template is silently dropped — render it, with its root `lang` and `i18n` (LT-351 ruling, ADR 0030 s9).
  **Skill:** le-truc-dev
  **Context:** ADR 0030 s9 (revised 2026-09-30) says a client-created instance speaks its
  creating parent's locale: the parent's server render bakes each composed child's root `lang`
  and `i18n` into the template it clones from. Today it does not. `validateListBody`
  (`lower-shared.ts:742-837`) admits a `compose` node nested inside the list output element,
  and `listTemplateLines` (`emit-server.ts:422-486`) then drops it at `:459` (`kind !== 'element'`).
  The child vanishes from the served `<template>` with no diagnostic. No corpus component hits
  this yet (the LT-351 inventory), so a fixture drives it.
  1. **Render a nested compose in the template** exactly as a rendered occurrence: call the
     child's `render*()` with its static args at the parent's effective locale (ADR 0030 s3
     precedence, so a child's own `lang` wins) and emit its full markup, root `lang` and `i18n`
     included. `cloneNode(true)` (`src/helpers/reactive.ts:831`) keeps both.
  2. **Reject what cannot be rendered once:** a compose whose args or children read the item
     hole or any per-item value. That is a new LTC code, tier 1 Prevented, statically decidable,
     no runtime half, identical on both surfaces (`diagnostic-parity.test.ts`). Tech Writer
     reviews the copy (developer drafts; add to LT-189's round or its successor).
  **Pins:** a fixture parent whose list item nests a client-keyed child renders the child's
  `lang` and `i18n` inside `<template>` at de and none at en (after LT-354); a jsdom pin
  clones an item and the child formats in de; the item-hole case is the new LTC on both surfaces.
  **Check:** gates green; server goldens for module-list and tokenbox templates byte-identical
  (neither nests a compose).
  **Docs on landing:** `server/compiler/HOST_PROFILE.md` ("A client-created instance speaks the
  source locale") gets the revised rule; Tech Writer reviews.

### C — Corpus port (LT-280 → LT-109–LT-111)

- [ ] LT-374: Enforce the raw-value-source rule for formatted reactive values (D-20).
  **Skill:** le-truc-dev
  **Context:** `HOST_PROFILE.md` data account bullet 6 (2026-10-01): text formatted for display
  does not parse back into state, so a formatted reactive value needs a canonical raw source —
  `value`, `valuenow` or `datetime` on an owned descendant (`<data value>`, `<time datetime>`),
  or a host attribute — and the generated client harvests from it. ADR 0043 s6 already relies on
  the rule. Two halves: (1) the compiler rule — a harvested prop whose only render site is
  formatted text (`Intl` formatting, a message call with a `number`/`date` argument,
  `toLocaleString`) with no raw source is an error, naming the `<data value>` / `<time datetime>`
  fix; (2) emit-client harvests from the raw source when one exists. Decide in the task how
  "formatted" is recognized and record it in HOST_PROFILE. LT-109/LT-110 (P5) format numbers and
  are the first corpus cases.
  **Channel/tier:** compiler, tier 1 Prevented (LTC059). Runtime: none — a harvest of formatted
  text cannot know the text was formatted. Tech Writer owns the copy.
  **Verification:** a failing fixture per formatting kind; a passing `<data value>` and
  `<time datetime>` fixture whose harvest round-trips; corpus byte-identical or each change
  justified; full gates.

- [ ] LT-186: A TSRX rule for an unkeyed element sibling of a `@for` in a reconcile container (LT-185's compiler half).
  **Skill:** le-truc-dev
  **Context:** LT-185 cost form-tokenbox its only text input: the `.tsrx` port dropped the
  `data-unreconciled` attribute, `reconcile()` removed the input as an unkeyed child of
  `data-container`, and nothing said so. LT-185 added the DEV_MODE warning for the runtime half.
  This is the compiler half, and the **user's direction (2026-09-06) is that TSRX is the better
  channel precisely because it is earlier** — the author learns at compile time instead of by
  opening a browser in dev mode. The shape is statically decidable for the `.tsrx` corpus: an
  element sibling of a `@for` inside the same `[data-container]`, carrying neither `data-key`
  nor `data-unreconciled`, will be removed at the first reconcile. Note the two channels are
  **complementary, not alternatives** — the compiler cannot see hand-authored HTML written by a
  library consumer, which is the case the runtime warning keeps covering. Do not retire the
  LT-185 warning when this lands.
  **Channel:** compiler (a new `TSRX0NN`), per ADR 0028 sub-design 1 — **confirmed at the
  LT-185 review**, and it is the user's direction: the compiler is earlier than a browser
  dev-mode warning. **Tier:** 1 (Prevented). **Error, not warning** — decided here so it is not
  re-litigated at implementation: the compile-warning baseline's target is zero (ADR 0029 s6,
  REQUIREMENTS M23), so a warning would either be fixed immediately or break the baseline, and
  the fix-it is one attribute. Check the false-positive shape FIRST — a container that
  legitimately self-cleans a dirty server render: if a corpus component needs that, come back
  before writing the rule rather than weakening it.
  **A deviation from ADR 0028's usual pairing, stated so it is not "fixed":** the ADR's Prevented
  tier says the runtime check "remains, behaving as Contained". Here the runtime half is LT-185's
  DEV_MODE advisory, not a Contained error — nothing fails at runtime, so do NOT convert it to a
  `console.error` or invent an error class to match the pattern.
  **Copy:** Tech Writer owns the final wording and reviews it against LT-185's runtime message so
  the two agree (the ADR 0028 lifecycle applies — this introduces a code).
  Acceptance: the form-tokenbox shape at its pre-LT-185 state produces the diagnostic; a sibling
  carrying `data-unreconciled` does not, and neither does `module-list.tsrx` (whose container
  holds only the `@for`) — pin both negatives, the vacuous assertion is the failure mode; the
  compile-warning baseline stays at 0 over the corpus; `bun test server` green.
  **ADR 0037 rider (2026-09-21):** reactive conditions inside a reconcile container are
  **banned** (compiler, tier 1) until this rule exists — and this rule must also cover (or
  explicitly exempt) ADR 0037's arm templates as container children. See
  [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) sub-design 5.

- [ ] LT-109: Migrate `module-calctable` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

- [ ] LT-390: A corpus consumer for reactive conditions and the boundary, with audit coverage.
  **Skill:** le-truc-dev
  **Context:** LT-274/LT-276 landed with no corpus component using either, so their golden
  and equivalence-audit acceptance items pass vacuously; adoption's designed connect diff is
  pinned only by `reactive-conditions.test.ts`. Migrate one example that wants a reactive
  `@if` (a disclosure or a tab-like switch) and pair the boundary with LT-334 (lazyload),
  extend `equivalence-audit.test.ts` to the arm-adoption class.
  **Depends on** LT-385.

### D — CSS departures (LT-409 → re-scoped)

- [ ] LT-405: A nested qualifier on `:host` evades LTC070 (LT-398 residue). — rolled back 2026-10-02, deferred to the design session
  **Skill:** le-truc-dev
  **Rolled back (owner, 2026-10-02):** the working tree is back to HEAD's behaviour for this case. `hostParent`, the codemod's
  `hoistNestedHostQualifiers` and their tests are removed, and the ~37 corpus sites are restored to the nested authored form
  (module-codeblock's `:global { pre/code }` block now follows `:host`). What follows records what
  the reverted change did, for the design session.
  **Was:** `checkRules` (`css-scope.ts`) carries `hostParent`, so `:host { &<qualifier> }` is
  LTC070 too (no new code). The codemod's `hoistNestedHostQualifiers` moves such rules to a
  sibling `:host(<qualifier>)` rule and keeps the flattened order. That migrated about 37 sites
  in 14 corpus sources. The emitted CSS changed in selector text only.
  **Ruling (owner, 2026-10-02 — the NOTES question; still describes the emission, documentation deferred to LT-408):** `:host(X)` keeps its all-zero emission
  (`:where(tag:is(X))` / `:where(:scope:is(X))`), arguments included, so page styles always win on
  the host. It is recorded as an s7 difference: a `:host(…)` argument carries no specificity, so a
  variant rule must follow the base rule it overrides. Documented by LT-408. The migrated
  corpus's specificity loss changes no computed value (static pass), and pixel confirmation
  rides LT-397. The nested face's copy and fix-it go to LT-407.

- [ ] LT-407: LTC070's nested face — `&<qualifier>` inside `:host { }` gets its own message and fix-it (LT-405 review).
  **Skill:** le-truc-dev (Tech Writer owns the copy)
  **Context:** (Written against LT-405, now rolled back: re-scope it from the design session. If LT-405's check returns, this follows it.) Since LT-405, `checkRules` reports `:host { &:hover { … } }` as LTC070. The message
  says "`:host` followed directly by a qualifier" and offers `:host(:hover)` as the fix. The author
  never wrote `:host:hover`, though, and following the fix-it in place nests `:host(:hover)` under
  `:host`, a descendant selector that matches nothing. Give `ContractFinding` a `nested` flag (set
  when the qualified component is a `&` standing for `:host`). Route it through
  `contractDiagnostic` to a second face of `diagnostic.hostQualifier`, saying that a qualifier
  after `&` in a `:host` rule qualifies `:host` itself, and that the fix is a sibling top-level rule
  `:host(<qualifier>) { … }` (the shape the codemod's `hoistNestedHostQualifiers` writes). The flat
  face's copy stays as it is. Update the diagnostic-parity fixtures if the face is surface-visible.
  **Channel/tier:** compiler, tier 1 Prevented (unchanged; LTC070 gains a face, no new code).
  Tech Writer reviews the copy and the `errors.md` row (owner's `.agents/` pass).
  **Verification:** a `css-scope.test.ts` case asserts the nested flag. A diagnostic test asserts
  each face's message (the nested one has no in-place `:host(…)` fix-it). `tsc` 0, server suite
  green.

- [ ] LT-408: Document the zero-specificity `:host(…)` arguments as an s7 difference (owner ruling 2026-10-02, LT-405 NOTES question).
  **Skill:** tech-writer (ADR 0033 s7 through adr-keeper)
  **Context:** Owner ruling (b): `:host(X)` keeps its all-zero emission, `:where(tag:is(X))` lowered
  and `:where(:scope:is(X))` native, arguments included, so page styles always win on the host
  (R1). In a real shadow root, `:host(X)` carries a pseudo-class's specificity plus X's, so
  `:host(.tiny) .label` beats `.label` in the same sheet whatever the order. Compiled, only
  source order decides. Add the difference to ADR 0033 s7 (in place, unpublished), to
  `styling.md` § Differences from a Real Shadow Root and to `HOST_PROFILE.md` § Styles, in the
  same words. The rule for authors: write variant rules (`:host(.x) …`) after the base rules they
  override. In the same pass, change s7's "its guarded `:host…` rules" to the docs' "non-bare
  `:host` rules" (LT-406 check).
  **Channel/tier:** none — copy only. (No check is added: an order-sensitive conflict needs
  cascade analysis across rules, which the compiler does not do. This is a recorded
  limitation, not a deferred check.)
  **Verification:** `check:links` green, and the three files state the difference in the same
  words.

### Parallel slot

- [ ] LT-305: Baseline guard — fail the build when shipped code needs a feature newer than the pinned baseline (REQUIREMENTS § Browser support). **Ships in 3.0.**
  **Skill:** le-truc-dev
  **Context:** Owner ruling 2026-09-24: the runtime baseline is **Baseline 2023**, pinned per
  major release to three years before it (3.0 → 2023); **minor and patch releases never move
  it**. The stated floor drifted once already (REQUIREMENTS said 2020 while `Object.hasOwn`
  set 2022), so a check replaces the prose. Record the pinned year in one place
  (the runtime's `package.json`, e.g. `"leTruc": { "baseline": 2023 }`; the baseline belongs
  to the runtime's major, ADR 0034 s8) and scan what ships: `src/`, the bundled
  `@zeix/cause-effect`, and the compiler's generated client modules and emitted CSS under the
  default `cssTargets`, against that year. Resolve features to Baseline dates with `web-features`;
  choose the scanner (a browserslist `baseline 2023` query fed to an API/syntax compat
  linter, or a direct `web-features` mapping) and justify it in the handoff. Features the
  runtime uses only behind a guard (`CustomStateSet`, ARIA reflection on internals) are
  allowlisted by name with the reason, never by pattern. A check that the pinned year only
  changes on a runtime major version bump is part of the gate. **Channel: build check, tier 1**
  (a CI failure; no runtime half).
  **Check:** the gate is green at HEAD with Baseline 2023; a fixture using a 2024-only API
  unguarded fails it; bumping the year without a major version fails it.

- [ ] LT-277: Seam hardening from the LT-267 review — glob dot-rule edges, `fileExists` contract, doc enumeration.
  **Skill:** docs-server-dev
  **Context:** the LT-267 review (2026-09-21) probed `server/runtimes/glob.ts` beyond the
  real-tree parity tests and found two edges where the seam's categorical claims do not
  hold, both verified live at 4097198c. Neither is reachable with any glob the repo or a
  realistic consumer writes today (they need an explicit-dot pattern segment, or a
  dot-prefixed path under a trailing `**`), but both contradict claims pinned in `glob.ts`'s
  JSDoc and `server/SERVER.md` — and the whole point of the shared translator is that these
  semantics are decided ONCE:
  1. **Trailing `**` matcher leak.** The trailing-`**` branch compiles to an unguarded
     `.*`: `matchGlob('mocks/**', 'mocks/.tmp')` and `matchGlob('**', '.hidden')` are TRUE
     while no scanner ever yields those paths — violating "a watcher filter cannot admit a
     file the scanner would never yield". Give the remainder the shape the interior `**`
     already uses (zero-or-more dot-guarded directory segments plus an optional dot-guarded
     file) and pin it with a test.
  2. **Explicit-dot scan patterns diverge per runtime.** `scanGlobSync` skips dotfiles
     unconditionally during the walk, but `Bun.Glob` yields files matched by an
     explicit-dot pattern segment (`new Bun.Glob('.env')` scans it; the walk returns `[]`).
     A consumer configuring a dot-prefixed source glob would get a different corpus under
     Bun than under Node — the exact divergence the seam exists to prevent. Decide at
     pickup: make the walk's skip rule pattern-aware (a pattern segment starting with `.`
     un-skips that level, matching Bun), or declare dot-prefixed patterns outside the
     grammar and reject them at config resolution. **Channel and tier (ADR 0028 s1) if
     rejected:** compiler/config resolution, tier 1 Prevented; if adopted, runtime seam
     semantics with parity tests, tier 2 Contained.
  3. **`node.ts` `fileExists` returns true for directories** (`access(F_OK)`) while the
     interface says "regular file exists" — the Bun impl matches the contract. Unreachable
     today (every caller passes a file path), but it is latent per-runtime divergence
     inside the seam itself; check the file type, not just existence.
  4. **Doc accuracy riders:** SERVER.md's "No Bun.* outside the seam" exception list omits
     `corpus-portability-check.ts` and `codemod-react-jsx.ts` under a "the only exceptions
     are" phrasing; and the portability check's diff report prints "first differing byte
     at N" where N is a code-unit index computed by a variable named `line`. One-line
     fixes. **Rider:** `scripts/i18n-sync.ts` still globs `examples/**/*.tsrx` only (the
     LT-267 handoff's unfiled residue) — fold here or into wave 4's migration of the first
     i18n-declaring `.tsx` component; until then it silently prunes nothing.
  **Check:** `server/tests/runtimes.test.ts` pins the trailing-`**` dot rule and the chosen
  dot-segment scan semantics on BOTH implementations; `check:portability` stays 3/3
  byte-identical.

- [ ] LT-393: Sweep the stale ADR 0023 citations in compiler module docs to ADR 0024 (LT-359 residue).
  **Skill:** le-truc-dev
  **Context:** The 2026-10-01 ruling fixed the compiler ADR's number: the isomorphic-format
  ADR is 0024, and its sub-design numbers already match — only the number is wrong.
  LT-359(c) swept the ruled scope (diagnostic copy in `diagnostics.ts`, message-bearing
  call sites, `errors.md`, the CHANGELOG line), but ~20 pipeline module docs still cite
  "ADR 0023" for compiler decisions: `config.ts`, `ir.ts`, `compose-attrs.ts`,
  `classify-attributes.ts`, `imports.ts`, `extract-context.ts`, `runtime.ts` JSDoc,
  `spans.ts`, `emit-server.ts`, `emit-client.ts`, `registry.ts`, `assemble-ir.ts`,
  `walk.ts`, `core.ts`, `core-shim.d.ts`, `css.ts`, `vocabulary.ts`,
  `setup-extraction.ts`, `ast-utils.ts`, `analysis/harvest.ts`, `analysis/plan.ts`,
  `analysis/selectors.ts`, `analysis/effects.ts` comments, `lower-shared.ts` JSDoc and
  `frontend/tsrx/*`. Comment-only sweep, zero behavior: comment citations move to
  "ADR 0024" (keep the sub-design number); a citation that genuinely means the
  bind-helper map-form ADR 0023 stays. Byte-identity gates protect the sweep (goldens
  unchanged proves comment-only).
  **Check:** `grep -rn "ADR 0023" server/compiler/` returns only genuine bind-helper
  citations; corpus goldens and parity byte-identical; tsc clean.

- [ ] LT-410: `errors.md` rows for LTC071 and the widened LTC051 (LT-402 handoff, found by Changelog Keeper at the 2026-10-02 prune).
  **Skill:** tech-writer (the owner's `.agents/` pass executes it)
  **Context:** LT-402's copy round reworded LTC066–LTC071 and gave LTC051 a boundary face (LT-403
  wired it), but the `le-truc` skill's `references/errors.md` has no LTC071 row and LTC051's row
  still describes only the sheet drift. The CHANGELOG's skill entry correctly says LTC061–LTC070,
  so update it to LTC071 in the same pass. Take the wording from `diagnostics.ts` as landed.
  **Channel/tier:** none — copy only.
  **Verification:** every `LTC` code `diagnostics.ts` can emit has an `errors.md` row; `check:links`
  green.
