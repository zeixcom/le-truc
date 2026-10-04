# DONE

Done-and-reviewed tasks since the last release, compacted into this ledger prose (the
`DONE.md` view is built from it by `bun run queue:build`; a task's own record lives in
`queue/LT-NNN.md` until a prune deletes it). Each entry keeps only what is still load-bearing:
rulings recorded nowhere else, live handoffs into open tasks (referenced by LT-ID), and the
changed-artifact facts the `writer` needs for the changelog at release planning. Verification
transcripts, changed-file line inventories and review narratives are dropped — the full record
stays in `git log -p`. Entries still carrying `— done, pending review ⏳` are finished but not
yet reviewed; their review pass happens in a future iteration. At release planning the
`writer` consumes the DONE view alongside `CHANGELOG.md [Unreleased]`; the Architect then
prunes `queue/LT-NNN.md` files whose context no live task needs, carrying homeless rulings
into this prose.

---

Pruned 2026-10-03, sixth pass (Architect, after the first `release-notes` run recorded
LT-370, LT-371 and LT-378 in `CHANGELOG.md [Unreleased]` and found LT-335 and LT-410 covered,
LT-373 and LT-393 internal). Consumed: LT-335, LT-370, LT-371, LT-373, LT-378, LT-393, LT-410.
Where their rulings live: `sim/realm.ts` § Attribution (LT-335), ADR 0044 s1 and LT-254's entry
(LT-370, LT-371), `do-task.js`'s commit step (LT-378's bundle-churn note), and the notes below.
Open handoffs: LT-411, LT-414, LT-416 in `BACKLOG.md`.

---

Pruned 2026-10-02, fifth pass (Architect, after the "consolidate the compiler, then land the
pre-publish reshapes" iteration closed; the `writer` recorded it in `CHANGELOG.md
[Unreleased]` the same day, deliberately omitting the byte-identical internal refactors).
Consumed: LT-227–LT-232, LT-234, LT-243–LT-245, LT-248, LT-268, LT-274–LT-276, LT-287–LT-289,
LT-304, LT-306, LT-358–LT-361, LT-364, LT-366–LT-368, LT-379, LT-380, LT-382–LT-386, LT-388,
LT-389, LT-394–LT-404, LT-406. Where their rulings live: ADR 0033 (s1–s10, the scoped emission
and the parse), ADR 0037 (amended by LT-388), ADR 0040 (s2, s4, s5), ADR 0043, ADR 0045, ADR
0032 s0/s4 and ADR 0038 s2 (LT-243's runtime-neutrality ruling), `walk.ts`'s module doc (LT-230's
`@pending` policy), and the notes below. Open handoffs are restated in their own entries:
LT-247, LT-254, LT-334, LT-335, LT-363, LT-369, LT-370, LT-378, LT-381, LT-387, LT-390–LT-393,
LT-405, LT-407, LT-408 (via LT-409). Earlier prunes: 2026-10-01, 2026-09-25 ×3, 2026-09-21 ×2.
Full entry text: `git log -p -- DONE.md`.

---

**Rulings carried from the 2026-10-02 prune** (recorded nowhere else; do not re-litigate):
- **The scope analysis stays in-house** (LT-231). `@typescript-eslint/scope-manager` cannot scope
  the `.tsrx` AST's non-ESTree nodes (`JSXCodeBlock` and its `render` slot). Do not re-propose it
  without a `.tsrx` story.
- **Three "can this read run" predicates stay apart deliberately** (LT-231): `reactivity.ts`'s
  classifier (reactive vs static), `harvest.ts`'s portable-seed allowlist (can the browser re-run
  the initializer), and the `.tsrx` in-template client-stmt allowlist. LT-373 centralizes the
  first; merging the others is LT-369's question, not a by-product.
- **Pass contracts are structural, not branded** (LT-289): a test may hand-build an empty
  `LoopPlans`. `runEffects`'s unread `_harvests` parameter witnesses pass order (query order is the
  byte-stable contract); if effects ever reads it, drop the underscore, keep the parameter.
- **`commonIndent`'s `skipDocContinuations` option stays** (LT-234): unifying the twins would move
  bytes for no benefit.
- **A duplicated `expose()` key is last-wins**, as at runtime (LT-288).
- **A hand-spliced Parser seed goes through `attrValue`** — the serialized attribute, not the
  expression's value (LT-386). The bare `() => host.<prop>` mirror for lazy text sites still splices
  the raw attribute expression on purpose: string/number parsers agree, only `asJSON` object values
  diverge pre-connect. Widening is demand-gated.
- **LTC065 is one code with two faces** (LT-394): the same tier and decision for the author.
  `@position-try` is deliberately absent from `DESCRIPTOR_ATRULES`, since its block holds properties.
- **Distributing `:is(:host …)` gives each member its own specificity** (LT-398), accepted because
  the members come from one authored list.
- **LTC051 reports one drift at a time** (LT-403): when sheets drift, boundary-only differences are
  named once the sheets match.
- **Corpus CSS fixes taken under LT-397** (input for LT-409): module-codeblock's `pre`/`code` rules
  are a top-level `:global { … }` block, and their leak into nested instances is accepted;
  colorinfo's `dt`/`dd` nest under `dl` (R1).
- **Docs-server routing is ours, not Bun's** (LT-364): first-differing segment kind wins
  (static > `:param` > `*`), params are `decodeURIComponent`-ed (a malformed escape is a 404), and
  traversal tests use an encoded slash (`..%2f`), since WHATWG URL parsing normalizes `%2e%2e`.
- **Narrowing a diagnostic's range later is not a breaking change to the record** (LT-371).
  Removing or widening a field is; a tighter `start`/`end` for the same construct is not.

**Open obligations** (not yet discharged; check before closing the named work):
- **`check:contract` is LT-254's proof against the published package** (LT-370): it now compiles
  through `compileComponentTsx` imported from `contract.ts` only, so run it against the packed
  `@zeix/le-truc-compiler`, not the source tree.
- **Track the lightningcss upstream issues #1081 and #1065.** `css-scope.ts` does string-level
  selector surgery over a read-only parse to avoid them; keep the `lightningcss-wasm` and
  `lightningcss-cli` pins on one version (ADR 0033 s9). Retire the surgery when both are fixed (LT-304).
- **Sandbox-blocked legs the owner reruns outside the sandbox:** `check:sim`'s Deno leg (LT-289),
  `check:portability`'s bun leg (LT-366, LT-230), and the `examples/test/scoping` Playwright run in
  both `cssTargets` modes, Chromium and WebKit, if LT-397's corpus run did not include it (LT-401).
- ~~**Upstream issues for the MF1 → MF2 converter are the owner's call.**~~ Discharged
  2026-10-01: tracker searched (no prior or similar reports), both filed by the owner as
  [messageformat#472](https://github.com/messageformat/messageformat/issues/472) (duplicate
  `.input` → `dedupeInputs`) and [#473](https://github.com/messageformat/messageformat/issues/473)
  (non-string skeleton literals → `stringifyLiterals`); still unfixed at 0.12.0. Compacted
  references live in `MF2_EXIT.md`; the pinned test flags an upstream fix — delete the matching
  normalization then (LT-253).
- **Browser specs the agent sandbox could not run:** `basic-pluralize.spec.ts`,
  `module-todo.spec.ts` and `form-tokenbox.spec.ts`, in en and de. The owner confirms they are
  green before the next PR (LT-252, LT-354).
- **The first `@empty` over a reactive List owes a browser spec leg** for the empty → filled →
  empty cycle. No corpus component uses it yet (LT-212).
- **CI has not yet proved the variant spec matrix.** CI triggers only on `main`/`next` pushes and
  PRs, not `v3`, so the next PR's run is the first proof. It must list every variant set, and a
  throwaway broken `.ts` twin must fail the job on surface "ts" (LT-295).
- **The simulation realm's timer ownership is process-wide.** Any host timer scheduled while a
  realm is open is cancelled at `dispose()`. That is safe only because `simulateCorpus()` runs in
  one-shot builds. A task that opens a realm in a long-lived process (dev server, watch
  rebuilds) must revisit it (LT-207).
- **The trap in `src/tests/reactive.test.ts`:** one assertion passes under both the pre- and
  post-LT-178 spelling. Tighten it once LT-189 item 11 settles the wording (LT-179).

**Standing notes for compiler-adjacent tasks:**
- **Shared compiler code never spells a surface's construct** (LT-233). It reads
  `wordingOf(ctx | component)` from `surface.ts`. `ComponentIR.surface` is optional, and absent
  means `.tsx` wording, because a required field would tighten contract IR. Diagnostic parity has
  two standing checks: equal code, severity and message after the allowlist, and a leak scan for
  `.tsrx` vocabulary in `.tsx` messages (LT-242).
- **"Server-only" is positive** (LT-348, LT-349). A name is server-only iff the server render
  binds it and no author-declared client binding rebinds it. Compiler-generated query locals never
  rebind. A tier never licenses an unbound client name. An undeclared name belongs to tsc, not
  LTC005. Setup consts and imports stay rejected in list bodies, because
  `computeClientNeededNames` walks no list-body position. Widening that walk is the fix if a
  component needs it.
- **The host profile's `JSX.LibraryManagedAttributes` distributes over unions** (LT-343). A
  plain `Omit` flattens a discriminated args type and drops its requirements. A union parameter
  type opts out of inline-literal type reading (`infer-type.ts`), so check the generated modules
  before spreading the pattern.
- **`| undefined` on an intrinsic attribute only where it literally means "absent when
  omitted"** (LT-308): component-tag config attributes that mirror an optional arg. Never ARIA or
  global attributes.
- **LTC055's refusals are what `Intl` cannot run** (LT-250): custom formatters, ICU number/date
  patterns, `precision-increment`, one argument as both number and date. `date`/`time` apply
  the record's `timeZone`, which diverges from `@messageformat/core` on purpose. The call-site
  check does not track shadowing.
- **`truc:html` fails closed on both halves; configure once per realm** (LT-138). The build and
  the browser are separate module instances. Pruning plural arms for a connect-time prop is
  declined, because the prop stays writable (LT-252).
- A compiler crash during a corpus build makes `typecheck`'s `&&`-chained `tsc` silently skip.
  Check the exit code, never grep for "error TS" (LT-226). A handoff's `check:corpus` claim is its
  **exit code**, not the warning baseline (LT-283).
- **A folded reactive thunk that reads page context is an error, not an omission** (LT-258).
  `Date.now()` is unresolvable in every tier; a page-context read is realm-answerable, so omitting
  it would silently re-route Folded → Simulated and out of template emission. The page-context
  side is the deny-list `PAGE_CONTEXT_GLOBALS` (`fold-inputs.ts`); the positive side is
  `assertFoldScopeClosed`. Keep that split. RNG stays on the impure-ambient side, and computed or
  aliased receivers (`crypto['randomUUID']()`, a destructured `randomUUID`) still fold as accepted
  residue, to revisit only on a real case (LT-314; LT-340 is the related indirection gap).
- **Client-only signal credit** means "at least one client-only read, none a render read" (not
  "every consumer client-only"), and the render read is transitive through setup consts
  (LT-323, LT-327). LT-333 extends it.
- **Harness-name aliasing covers only emitter-synthesized sites** (LT-302). Authored text keeps its
  spelling, and `host`/`internals` are never aliased.
- **`truc:pass` addressing** (LT-338, LT-319, LT-339). An auto-addressed site is a **required**
  query (`'one'`), the same as a raw custom element. A shared-class group lowers to one
  `pass(all(…))` only on **textual** identity of the `truc:pass` objects, never semantic
  equivalence, and only when every member would reach the fallback itself. The imperative
  `pass(all(…))` stays sanctioned as a client-only setup statement (tier 2).
- **A loop is diagnosed only when its output IS a branch root** (LT-301). A loop wrapped in an
  element inside a branch stays legal. Branch-scoped `each()` is a design task when a migration
  first needs it.
- **`<truc:try>`** (LT-303): `tsc` owns the arm types, the repeated arm and the missing `catch`.
  The compiler keeps one LTC005 shape error and also guards the missing `catch`, because it never
  runs `tsc`. As a `.map()` output root it is LTC053, matching `.tsrx`. LT-276 reshapes the `try`
  node under both front ends.
- **Generated typings** (LT-312, LT-325). Import keys are the shortest path suffix no other
  source shares, so a collision fails loudly. The file is always written, even empty. A
  `.tsx`-served tag gets no generated tag-map entry, because its authored source carries one and
  a second would be TS 2717. The examples typecheck leg needs a corpus build first.
- **The canonical output directory is not pruned** (LT-296). The route serves a canonical client
  only when `registry.json` selects that surface; `compileCorpus` owns and prunes only
  `variants/`.
- **The simulation realm** (LT-188, LT-332). A Folded/Static child in the composed closure runs
  its connect in the realm, and its diagnostics attribute to the rendering parent, which is
  intended. A connect-time page-context API the realm lacks (`history`, `requestAnimationFrame`)
  gets an **inert stub** in `patch-table.ts`/`capabilities.ts`, not a standing classification.
- **Dynamic tags** (LT-213, for the future `<truc:element tag={…}>`, ADR 0041). Address such an
  element by class/id/`data-*`, never by tag. No React-style `const Tag = …; <Tag>`, which
  collides with PascalCase compose dispatch. IR shape:
  `tag: { kind: 'static', name } | { kind: 'server', exprText }`.
- **`argsFromAttrs`** (LT-290, LT-095). Declaring a ref stub inside the page-occurrence helper
  was rejected, because a `refStub` value would reach the markup. A server arg's page-occurrence
  attribute is its **kebab-case** name; a `number` arg has a numeric channel (blank = absent,
  non-numeric = unrenderable). LT-297 and LT-336 continue this.
- **The size bet holds on the runtime, not the payload** (LT-266): 8.72 vs 64.38 kB gzip runtime;
  the payload line (3.07 vs 8.54) favours React. Any connector claim quotes **both** lines. Run of
  record: `spike/size-bet/FINDING.md`.

**Standing notes for wave-4 migrations:**
- **Don't contort a component to dodge a classifier gap; file the gap** (LT-103). Record tier and
  reason as they land. Tier predictions are often wrong: refs used only in `watch`/`on` never route
  (LT-096).
- **`bun run build:docs` is part of every migration's check** (LT-095): it caught a demo
  regression nothing else ran.
- **A Parser-exposed prop's text site is a `{() => host.<prop>}` thunk**, not the arg (LT-099).
- **A client that writes a style or ARIA value at connect gets a server render in the exact form
  the watcher writes**, so the connect diff is empty (LT-102).
- **A compose site cannot put attributes on the child's inner element**, so an opener needing
  `aria-haspopup` renders as a raw `<button>` (LT-101). The dialog's `body.scroll-lock` waits for
  LT-306's `:global()`.
- **A raw dashed tag seeds a child import only when a query addresses it** (LT-291).
- **A provider's context keys live in a module with no side effects**, never in the component
  module, because importing a component module defines the element (LT-106; docs in LT-189
  item 14).
- **Lazyload keeps its hand-written `watch(content, { ok, nil, stale, err })`**. The compiled
  boundary cannot express that contract until LT-334 (LT-104).
- **No compiler-stamped hash class for addressing** (LT-096): page-authored occurrences never pass
  through the compiler's render, so a stamped hook would be absent where the enhancer binds. The
  `:not(<tag> *)` exclusion is accepted; its only miss is an own element inside a same-tag
  ancestor of the host, which no composition produces.
- **Scrollarea's wall time at demo scale is noise** (LT-103).

---

**Since the 2026-10-03 prune:**

- [x] LT-375: Enforce root-is-host and migrate the fragment-root `.tsx` sources (D-07). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-371
  **Context:** owner ruling 2026-09-29, recorded in ADR 0032 s1 and `HOST_PROFILE.md`: the
  template's root is the host element, there is no fragment root, and `<style>` is a child of
  the root. 16 of 17 corpus `.tsx` sources still wrap the root and its `<style>` in a fragment.
  Migrate them (mechanical: move `<style>` inside the root, drop the fragment) and then make the
  fragment root a compile error naming the fix. Check what `.tsrx` accepts and give it the same
  answer (ADR 0032 s6 parity; D-04 is parked, so `.tsrx` stays first-class). LT-306 also rewrites
  every corpus sheet; land together or one right after the other, not interleaved.
  **Channel/tier:** compiler, tier 1 Prevented (LTC060). Runtime: none (a source shape). Copy
  follows `writer` → error-messages.
  **Verification:** goldens byte-identical across the migration (the fragment never reached the
  output); the new rule's fixture; diagnostic parity; full gates.
  **Changed:** LTC060 (tier 1 Prevented, compiler channel) refuses a `<>…</>` fragment root from the
  shared driver on both surfaces, with shape-neutral copy; 39 corpus sources (`.tsx` and `.tsrx`) and
  the test fixtures migrated mechanically (`<style>` inside the root, fragment dropped); every
  `<style>` block byte-identical to `1acffc9e^`; docs (`compiled.md`, `errors.md`, `HOST_PROFILE.md`,
  `VOCABULARY_LEDGER.md`, CHANGELOG) updated. Follow-up: LT-417.
  **Review (Architect, 2026-10-04):** Approved. Rework `dd6d4f9c` (committed straight to v3, no task
  branch) answers both findings: all 39 `<style>` blocks compare byte-identical to `1acffc9e^`, and
  `git diff -w` is only the fragment lines plus Biome-forced setup reformatting — colorinfo's
  semicolons included (`semicolons: asNeeded`), contrary to the Reworked note. The note's "Left"
  items are stale: the `diagnostics.ts` union comment is shape-neutral in the same commit, and
  `errors.md` has no other LTC060 mention. Gates green on HEAD (server suite 2880/0, typecheck,
  `check:corpus`, `check:contract`, Biome). `test:variants` is unrunnable in the sandbox (every
  Playwright test times out); the owner runs it once outside.

- [x] LT-387: Reactive-condition mode classification follows scope (LT-274 review). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-373
  **Context:** `validateCondition` (`lower-shared.ts`) goes reactive only when a free name is a
  signal or `host`. An alias — `const isOpen = () => open.get(); @if (isOpen())`,
  `const o = open; @if (o.get())` — compiles silently as `mode: 'server'` and never updates,
  against the documented contract; conversely a `@for` binding that shadows a signal name
  (`@for (const open of items) { @if (open) … }`) is classified reactive and refused.
  Resolve setup aliases to their signal (or refuse the read, tier 1 Prevented) and make
  `freeIdentifiers` scope-aware. Ride-along: `check:contract`'s scratch front end crashes in
  `analyzeClient` on an undefined `component.firstRefs` (fails on HEAD before LT-274 too).
  *(Planning, 2026-10-02: discharged by LT-370 in gate zero — same stale toy IR; drop the
  ride-along if `check:contract` is green when this is picked up.)*

  **Changed:** `server/compiler/lower-shared.ts`: `validateCondition` refuses a condition that reads a setup alias of a signal or `host` (new `unsupported` diagnostic, wording is new copy); loop item, index and key bindings now shadow same-named signals when a condition is classified (`lowerLoopBody`). `server/compiler/extract-context.ts`: new `ExtractContext.loopBound` stack of loop bindings. `server/tests/compiler/reactive-conditions.test.ts`: regression tests for the alias refusal and loop shadowing. `scripts/worktree.ts`: strict-mode narrowing of the `--message-file` argument (no behavior change).
  **How:** Accepted the finding. A compiler-authored semantics and diagnostic change, so `api` (pending-review). Before, `const isOpen = () => open.get()` followed by `@if (isOpen())` classified as server mode and went stale. It is now refused with the existing `unsupported` (LTC005) diagnostic, which says to read the signal or `host` directly. The alias check is transitive over setup const initializers and covers both surfaces. Loop bindings shadow same-named signals while the body is lowered, so a shadowed name is no longer misclassified as reactive. Gates in the worktree (read-only lint form): `bun test server/tests` 2874 pass, 0 fail; `biome check ./server` clean; `typecheck` ok; `check:contract` ok; `check:corpus` ok (36 components). Biome format findings exist only under `scripts/`, outside the `lint:server` gate.
  **Check:** (1) The alias refusal in `validateCondition` (about lines 143-156): is refusing, not classifying as reactive, the intended resolution? Does the copy meet the error-message standard? It reads as a run-on, with no comma after `host`; get the writer review. (2) Loop shadowing: a loop binding named like a signal now classifies server-mode inside the body in `.tsx` and `.tsrx`; confirm the scoping. (3) Tests are weak: the shadowing test only asserts the absence of a string this path never emits, covers only the `@for` item binding, and runs only on `.tsrx`; the alias test is `.tsrx` only and brittle. (4) `lowerLoop` (static loop) does not push per-item hoisted consts onto `ctx.loopBound`, so `const open = item.open` then `@if (open)` still classifies reactive: same shadowing class, not fixed. (5) Propagation gap: the LTC005 row, `LE_TRUC_COMPILER.md` and CHANGELOG `[Unreleased]` do not yet name the alias face. (6) The `scripts/worktree.ts` hunk is unrelated and can be split out.

  **Review (Architect, 2026-10-04, `review-pending`):** changes requested ↩ — the calls check out:
  refusing live aliases is the right tier-1 shape (classify-reactive would need alias resolution
  through the deps closure and every emitter; refusing is trivial and semantics-safe) and rides the
  existing LTC005/Prevented channel (ADR 0028 tier 1) as the Context prescribed; the restoring
  `loopBound` stack is the right mechanism — `.tsx` `.map()` and `.tsrx` `@for` both lower through
  the shared `lowerLoop`/`lowerListLoop`, so the shadowing fix lands on one `lowerLoopBody` seam in
  `lower-shared.ts`, where the anti-drift contract wants it; all five claimed gates re-run green in
  `.worktrees/LT-387` during this review (`bun test server/tests` 2874 pass / 0 fail; `bunx biome
  check ./server` clean; `bun run typecheck`, `check:contract`, `check:corpus` exit 0, 36
  components). (1) `server/compiler/lower-shared.ts` — the alias refusal over-refuses the
  eager-snapshot face: `const snapshot = open.get()` then `@if (snapshot)` compiled clean as a
  one-shot server boolean at HEAD (fixture compiles clean on 922f5d81) and is now refused LTC005 on
  both surfaces, while `validateCondition`'s own JSDoc (:123-124) still promises "server-known at
  render time (args, setup consts, globals)" and the fix advice ("read the signal or `host`
  directly") would silently turn a correct one-shot server render into a reactive branch — a
  behavior change for previously-compiling code. Cause confirmed: `readsSignalThroughAlias`
  (:100-116) walks `freeIdentifiers` (ast-utils.ts:432), which collects `open` from the eager call
  exactly as from a live alias — `= open`, `= () => open.get()`, `= open.get()` indistinguishable to
  it (probes: all three refused). The entry's Context names only the two live faces; the contract
  violation does not exist for the eager face. — Exempt initializers that eagerly dereference the
  signal: an `X.get()` call whose `X` resolves to a signal directly or through alias recursion (the
  transitive face `const s = open.get(); const t = s; @if (t)` is also currently refused and must be
  exempt); `const a = open.get` without the call and any function whose body reads a signal stay
  refused. `@if (snapshot)` then returns to `server` as the JSDoc promises; update the JSDoc
  sentence to the narrowed rule. (2) `server/compiler/lower-shared.ts` — hoisted per-item consts in
  server-data loops still don't shadow, the same class inside the function the change modifies:
  `lowerLoop` collects the hoisted names (:1109-1143) but the `lowerLoopBody` call at :1170 passes
  only `[itemName, loop.index?.name]`. Verified by compiling both faces post-change: `@for (const
  item of items) { const open = item.open … @if (open) }` on `.tsrx` and the block-bodied `.map()`
  twin on `.tsx` still refuse with the misleading "reads a signal inside a server-data `@for`
  body" / "… `.map()` body" — the author wrote a per-item const read, not a signal read. The
  reactive-list path refuses hoisted consts outright (:996-1007), so only this each face is
  exposed; a4d2899d's own message admits it ("Hoisted consts in static loops still do not shadow
  signals; not covered here."). — Pass the collected names too: `lowerLoopBody(ctx, [itemName,
  loop.index?.name, ...hoisted.map(h => h.name)], …)` at :1170, plus a regression fixture with a
  hoisted const shadowing a signal, both surfaces. (3) `server/tests/compiler/reactive-conditions.test.ts`
  — the two new tests do not guard the fix. (a) the shadowing test (:937, assertion :945) asserts
  `not.toContain('condition that reads a signal')`, a substring the path's refusal never contains —
  the pre-fix compiler emits "An `@if` or `@switch` that reads a signal inside a server-data `@for`
  body …" (verified: the identical fixture against HEAD yields exactly that diagnostic; message
  sources unchanged 02a1de91→HEAD) — so the assertion passes on unpatched code and would pass again
  on regression: vacuous both directions. (b) both tests compile only the `.tsrx` helper (:927,
  :939) though the entry's How claims "covers both surfaces", surface.ts:15-18 pins cross-surface
  message parity, and the `.tsx` faces are real (probes: `.tsx` alias refusal, `.tsx` `.map()` item
  shadowing compiling clean — nothing pins either). (c) the alias assertion (:932) pins a message
  phrase, which any copy reword breaks — brittle. — Assert positively: the shadowing fixture
  expects `errors(...)` `toEqual([])` on both surfaces (house pattern of the neighboring test
  :905-915; verified post-fix that both surface variants compile with zero diagnostics),
  parameterize both tests over `.tsrx` and `.tsx` (`compileComponentTsx` already imported :19);
  prefer the diagnostic code (LTC005) over a message phrase for the alias test. (4) `CHANGELOG.md`
  — propagation gap: neither user-visible face is recorded anywhere, against the writer standard
  (error-messages.md:95-109, a user-visible message change is a change). Verified: the
  [Unreleased] "Reactive conditions" bullet (:39) says nothing of the new refusal or the loop-scope
  scoping (grep LT-387 / setup alias / loop binding: no hits); the LTC005 row (errors.md:121)
  enumerates the server-only and arm/branch faces but no condition-alias face; LE_TRUC_COMPILER.md's
  `conditional` IR row (:433) still defines reactive mode as plainly "the test reads a signal or
  `host`", no alias-refusal or loop-scope note; the `validateCondition` JSDoc (:118-126) still
  states the old rule. — Add one Changed bullet covering both faces (an alias condition compiled as
  server mode and never updated — now refuses; a shadowed `@for`/`.map()` binding refused — now
  compiles); extend the LTC005 row with the alias face and the loop-scope note; add a sentence to
  the `conditional` row (and the ForIR body rules, :438, if (2) lands); amend the JSDoc. This item
  absorbs the JSDoc finding (reviewer finding 13), whose fix is the JSDoc sentence listed here.
  Nits fixed by the reviewer (3f5253ac): lower-shared.ts:151 `what` now reads "…, which reads a
  signal or `host`," — comma closing the relative clause (`diagnostic.unsupported` appends " is
  outside the supported subset (ADR 0024)." straight onto `what`, diagnostics.ts:594) and "setup
  alias" → the established "setup const" term (errors.md:121, JSDoc :123); per the writer standard's
  message-substring checklist (:111) assertions were grepped first — the only hit was the new
  test's own, updated to follow the phrase (:932 'reads the setup alias' → 'reads the setup const',
  not weakened; test name :923 keeps the alias concept; no other file asserts either message).
  lower-shared.ts:163 — sibling garden path closed ("…, which the server render does not know,").
  Commit split: `git reset --soft 8ef3f8d5`, scripts/worktree.ts alone re-committed as 2d38db32
  (`queue:` subject convention), the three server/ files re-committed as 330648fb with the original
  compiler message byte-identical (`git commit -F` of `git log -1 --format=%B a4d2899d`); `git diff
  a4d2899d 330648fb` empty — tree identical to the original single commit. Follow-ups: none.

  **Reworked:** (1) fixed — new module-local `eagerlyDereferencesSignal` (server/compiler/lower-shared.ts:118-158) accepts an `X.get()` CallExpression (non-computed `.get` member, identifier object) whose `X` is a declared signal, `host`, or resolves to one through `readsSignalThroughAlias` (the live predicate, unchanged), and propagates through bare-identifier initializers so the transitive face `const s = open.get(); const t = s; @if (t)` is exempt too; the alias find in `validateCondition` (:192-197) skips eager names before the live check, and the JSDoc (:160-175) states the narrowed rule. Probed before/after with `compileComponent`/`compileComponentTsx`: at baseline all three eager faces refused LTC005; post-fix `const snapshot = open.get()` + `@if (snapshot)` and the transitive face compile clean on `.tsrx`, falling through to `server` exactly as the JSDoc promises (setup consts are all in `serverKnown`, setup-extraction.ts:668), while `const a = open.get` without the call and the live functions/bare aliases still refuse. The exemption's boundary verified for the record, per the review's spec that an eager deref wrapped in anything else stays refused: only the plain `X.get()` face is exempt — computed `open['get']()`, optional `open?.get()`, a transitive method-ref without the call, a bare `host` member read and a mixed condition (`@if (good && bad())` with a live `bad`, which is caught and named) all still refuse LTC005; `.get()` through a bare signal alias is exempt (still one dereference), `seen` is fresh per free name so no cross-name contamination, and `setupInits` admits only single initialized `const` declarations (setup-extraction.ts:190-203), so no mutable-binding edge can undermine the snapshot guarantee. (2) fixed — `lowerLoopBody(ctx, [itemName, loop.index?.name, ...hoisted.map(h => h.name)], …)` (lower-shared.ts:1222-1226), exactly as prescribed. Render probe through the emitted server module on both surfaces: `@for (const item of items) { const open = item.open; @if (open) … }` and its block-bodied `.map()` twin render the per-item branch (`<b>` for `open:true`, `<i>` for `open:false`) with zero diagnostics — probe artifacts under gitignored `server/generated/`, since removed. The reactive-list path needs nothing: it refuses hoisted consts outright and `lowerListLoop` passes `[itemName, keyName]` (:1072); the empty arm lowers outside the restored stack. (3) fixed — the LT-387 describe rewritten as four `test.each(['tsrx','tsx'])` tests (server/tests/compiler/reactive-conditions.test.ts:936), plus a new `.tsx` fixture helper: the live-alias refusal asserts `errors(...)` codes `toEqual(['LTC005'])` over three live faces including the method-ref without the call (no message phrase), the eager-snapshot test asserts direct and transitive faces `toEqual([])`, and the item-binding and hoisted-const shadowing fixtures each assert `toEqual([])` on both surfaces — the house pattern of the neighboring static-markup test. Guard proven, not assumed: with HEAD's lower-shared.ts temporarily swapped in, exactly the four fixed-behavior tests fail (eager snapshot `.tsrx`/`.tsx`, hoisted shadow `.tsrx`/`.tsx`); with the fix restored all pass. Grepped for message-substring assertions on the touched copy: only the rewritten test asserted one, and it is gone. (4) fixed — CHANGELOG `[Unreleased]` gains one Changed bullet covering both faces (CHANGELOG.md:102); the LTC005 row (skills/le-truc/references/errors.md:121) gains a **Condition face** — the live-alias refusal plus the eager-snapshot and loop-scope carve-outs; the `conditional` IR row (server/compiler/LE_TRUC_COMPILER.md:433) states classification-follows-scope and the `ForIR` paragraph states the body-binding shadowing (:442-444); `validateCondition`'s JSDoc carries the narrowed rule. `skills/le-truc/references/compiled.md` re-read: nothing there became false (no row mentions aliases or loop shadowing), left untouched per the review's enumerated targets. Gates re-run green from inside the worktree: `bunx biome check ./server` clean; `bun test server/tests` 2880 pass / 0 fail; `bun run typecheck` exit 0 (36 components); `bun run check:contract` and `bun run check:corpus` exit 0. Not run, per the Gates table's conditions: `build:docs`/`check:links` (no emission change; the only JSDoc touched is an internal compiler function, not published-API docs) and `test:variants` (no variant set touched). Residual note, for the record: the new `ForIR` sentence (LE_TRUC_COMPILER.md:442-444) — "a conditional over them classifies `server`" — overclaims: probes through `compileComponent` show a conditional over a body binding that shadows no server-known name is still refused LTC005 (`@if (flag)` over `const flag = item.open`; likewise `@if (item.open)`, `@if (item)`, `@if (i > 0)`; all identical at HEAD per `git show HEAD:server/compiler/lower-shared.ts` in a /tmp copy), so the behavior is pre-existing and untouched while the added sentence promises the server classification unconditionally. The shadow-scoped case, the sentence's actual subject, probes clean to `mode: 'server'` (`serverKnown` = items,isPending,open); errors.md's parallel phrasing ("shadowing a same-named signal is the binding, not the signal") is precise — only this sentence drifts.

  **Review (Architect, 2026-10-04):** Approved. The rework (51483392) answers all four findings,
  verified in the hunks: `eagerlyDereferencesSignal` exempts the eager-snapshot face (cycle-guarded
  alias recursion, non-computed `.get()` only; boundary faces probed and still refused),
  `lowerLoopBody` receives the hoisted const names, the LT-387 describe is a surface-parameterized
  suite asserting `toEqual([])` positively and LTC005 by code, and the CHANGELOG / errors.md
  LTC005 / LE_TRUC_COMPILER rows record both faces. Reviewer nit on the branch (6522847d): the
  ForIR sentence now scopes the server classification to the shadowing case, matching errors.md.
  All gates green in the worktree; typecheck re-run green on the merge (d6521444 — the branch's
  duplicate `worktree.ts` strict-mode hunk resolved to v3's `dadcbaba` version).

- [x] LT-391: An arm kind for `SuppressedSite` (ADR 0037 s5 under the Simulated tier). — reviewed ✓
  **Area:** compiler
  **Context:** LT-274 review. A reactive test over the wall clock or RNG (ADR 0029 limb b)
  correctly renders no live arm, but when the component is Simulated for another reason the
  realm's connect clones an arm into the served HTML. Record suppressed arm sets and strip
  the realm-cloned arm before serialization, as other limb-(b) sites are.
  **Changed:** `SuppressedSite` gains an `arms` kind (container selector or `'host'`, plus the
  `data-arms` index), recorded by `handleReactiveConditional` when a reactive condition's test has
  no initial fold and reads the clock or the RNG (limb b). Before serializing, the realm strips the
  arm the replayed `reconcile()` cloned (`liveArmOf`, which applies reconcile's adoption rule), so the
  served HTML keeps the server's arm-less skeleton, and a repeat render produces the same HTML.
  `suppression.test.ts` covers `@if`/`@switch` and the `.tsx` ternary, `&&` and switch-IIFE forms,
  over both the RNG and the wall clock. `LE_TRUC_COMPILER.md` and `TESTS.md` document the record form.
  **Review (Architect, 2026-10-04):** Approved after one rework round (`14b83427` on v3, rework
  `910790dc` on `task/LT-391`). Ruling: no `SIMULATION_SEAM_VERSION` bump. The seam is unpublished and
  only the in-package driver exists, so version 1 is whatever 3.0 ships. The bump rules apply from
  the first release. An arm set that can't fold for another reason (an unseeded Parser prop) still
  ships the realm's arm, as ADR 0037 s5 intends. The rework's tests are proven to guard the strip:
  with the strip disabled, all four arms tests fail.

- [x] LT-418: Bring the `architect` and `writer` skills up to the queue store and the four workflows (SKILLS_REPORT R5 residue). — done ✓
  **Area:** docs
  **Gates:** check:queue
  **Context:** the queue moved to a per-task store (`queue/LT-NNN.md`, `queue/ITERATION.md`,
  `queue/BANDS.md`, `queue/LEDGER.md`; `BACKLOG.md`/`TODO.md`/`DONE.md` are views built by
  `bun run queue:build`), but `architect/SKILL.md` rule 2 and `references/task-queue.md` → *Moves*
  still describe hand-moving entries between the three files and "prune `DONE.md`", and
  `writer/references/changelog.md` → *Sources* names `DONE.md` as the thing the Architect prunes.
  Neither skill names the `release-notes`, `skill-drift` or `review-pending` workflows where their
  step happens. Run `skill-drift` on `architect` and `writer`, then make sure the proposals also
  say: a move is a `status:`/`band:` edit in the store followed by `queue:build`; a prune deletes
  `queue/LT-NNN.md` and carries rulings with no other home into `queue/LEDGER.md` (the
  2026-10-03 sixth pass is the worked example); *After a release* runs `release-notes` first and
  prunes from its `consumed` list; `skill-drift` runs before a release, per unit (a full run is
  ~19 agents). Proposals go to `.agents-proposals/` for the owner's copy-in.
  **Channel/tier:** none — guidance only.
  **Verification:** `check:queue` green; every command and path the proposals name exists.

  **Changed:** `.agents-proposals/skills/architect/SKILL.md` — full-file proposal: rule 2 describes the per-task store (a move = `status:`/`band:` edit or chain edit in `queue/ITERATION.md` + `bun run queue:build`; a prune deletes `queue/LT-NNN.md` and carries homeless rulings into `queue/LEDGER.md`); rule 3 names the `review-pending` workflow and `worktree.ts integrate`; the chain obligation points at `queue/ITERATION.md`; the Files table names `queue/` with the three built views. `.agents-proposals/skills/architect/references/task-queue.md` — full-file proposal: store+views intro, store file table, front-matter entry format, status suffix ↔ `status:` mapping (incl. the `status: note` note), store-accurate `check:queue` failure list, and *Moves* rewritten — *Iteration planning* edits the chain; *After review* runs `review-pending` and compacts the task file in place; *After a release* runs `release-notes` first and prunes from its `consumed` list (the 2026-10-03 sixth pass as the worked example), `skill-drift` before a release per unit (~19 agents full run). `.agents-proposals/skills/writer/references/changelog.md` — full-file proposal: *Sources* says `DONE.md` is a generated view of the store (ledger prose in `queue/LEDGER.md`) that the Architect prunes from the `release-notes` run's `consumed` list; *Release* names `skill-drift` before a release (per unit, ~19 agents full run) and `release-notes` (`.claude/workflows/release-notes.js`) as step 1.

  **Review (Architect, 2026-10-03, `review-pending`):** changes requested ↩ — the store-facing
  claims check out (front-matter/statuses queue-store.ts:39-48,130-133; the check:queue failure
  list :526-586; integrate gate+merge worktree.ts:280-316; skill-drift units skill-drift.js:27-50;
  release-notes' consumed list release-notes.js:196-199; the sixth-pass example queue/LEDGER.md:12-16),
  and `bun run check:queue` is green in `.worktrees/LT-418` (34 pass / 0 fail).
  (1) task-queue.md:91 credits unsigned worktree commits to the bootstrap alone; the unconditional
  mechanism is the commit step's `-c commit.gpgsign=false` (worktree.ts:264 — "the actual
  guarantee", :88-92 — the bootstrap write is best-effort, skipped with a note :96-110), and the
  replaced HEAD text (:70) had the two-mechanism wording — restore it: the commit step passes
  `-c commit.gpgsign=false` (owner ruling 2026-10-03), touching no config file; the bootstrap
  additionally sets `commit.gpgsign=false` worktree-locally (`extensions.worktreeConfig`) where the
  host allows config writes and skips it with a note where it does not (Claude Code's sandbox blocks
  `.git/config`). (2) task-queue.md:103 makes `blocked ⛔` stall a track — both picks skip it and
  continue the track (queue-store.ts:661; comment :650-652 "a claimed or
  non-contract task standing first ends its own track"), and :101's own ready definition says
  "satisfied or `blocked ⛔`" — rewrite to: a next task claimed (`⚙`) or on a non-contract status
  stalls the track and the scan falls through; a `blocked ⛔` task is skipped and the track
  continues. (3) task-queue.md:102 "in file order" is a kanban leftover (queue-store.ts:638-640); the
  store pick takes rework in chain order over flatChain (queue-store.ts:638-640) — "in chain
  order". (2)/(3) sit on the contract page (:5 "the contract that script implements", fix in the
  same commit), so each wrong line invites a behavior-breaking script "fix". (4) writer
  document-map.md:341 — "any pipeline *code* goes to `docs-server-dev` as a `BACKLOG.md` task"
  teaches the hand-edit-of-views anti-pattern this entry purges (`BACKLOG.md` is a built view;
  `docs-server-dev` exists nowhere in the store, no band matches) — add a writer proposal
  (document-map.md or an addendum) rephrasing to store language, naming the work's home without
  implying a band: "a task in the queue store, `queue/LT-NNN.md` with a `band:`, rendered into
  `BACKLOG.md` by `bun run queue:build`".
  Nits fixed in the worktree (5b1de37a): SKILL.md:37 triage now ends "a banded task in the store";
  task-queue.md:65 band range covers lettered sub-bands (`P2b`, per :53 and BANDS.md:131);
  task-queue.md:5 claim narrowed to "every rule in *Entry format* and *The chain*" (matches
  loadStore :193-216 and checkStore :524-582).
  Follow-up: `queue/ITERATION.md`'s own header still opens on the retired three-file mini-kanban —
  resolved by the Architect directly (queue prose is the Architect's file), no task. Follow-up:
  LT-421 document-map.md:341's `workflows/improve-docs-architecture.md` pointer is dead — filed as
  LT-421; fix it in the same pass as (4).

  **Changed:** `.agents-proposals/skills/architect/references/task-queue.md` — findings (1)-(3): line 91 restores the two-mechanism unsigned-commit wording (the commit step's `-c commit.gpgsign=false` touching no config file is the guarantee; the worktree-local `extensions.worktreeConfig` write is additional and best-effort, skipped with a note where the host blocks `.git/config`); line 102 "in file order" → "in chain order"; line 103 rewritten so a claimed (`⚙`) or non-contract next task stalls the track while a `blocked ⛔` task is skipped and the track continues. `.agents-proposals/skills/writer/references/document-map.md` — new full-file proposal (finding (4)): identical to the live `.agents/skills/writer/references/document-map.md` except line 341, which now reads "any pipeline *code* goes to a task in the queue store, `queue/LT-NNN.md` with a `band:`, rendered into `BACKLOG.md` by `bun run queue:build`" and points at `references/docs-architecture.md` instead of the dead `workflows/improve-docs-architecture.md` — the LT-421 fix, done in the same pass as (4) as the review directed.
  **Reworked:** (1) fixed — task-queue.md:91 restores the two-mechanism wording: the commit step's `-c commit.gpgsign=false` (worktree.ts:264, owner ruling 2026-10-03) is the unconditional guarantee and touches no config file; the bootstrap's `extensions.worktreeConfig` write (:88-92) is additional and best-effort, skipped with a note where the host blocks `.git/config` (:96-110). (2) fixed — :103 now stalls a track only on a claimed (`⚙`) or non-contract next task; a `blocked ⛔` task is skipped and its track continues (queue-store.ts:661). (3) fixed — :102 reads "in chain order" (queue-store.ts:638-640). (4) added — `.agents-proposals/skills/writer/references/document-map.md`, the live file with :341 rephrased to store language and the dead pointer swapped for `references/docs-architecture.md`; LT-421 folded in per the review's same-pass directive. `bun run check:queue` re-run green in the worktree (34 pass / 0 fail).

- [x] LT-419: Move the `contributor` reference facts into writable homes (SKILLS_REPORT R1/R2 residue). — done ✓
  **Area:** docs
  **Needs:** LT-418
  **Context:** R1 moved the server-only facts to `server/SERVER.md` and R2 limited reference files
  to what has no writable home, but `contributor/references/docs-server.md` still keeps its traps
  (the two `html` tags, `raw()`, `guardPath`, HMR conditions, the Markdoc-tag checklist) with a
  note to move them, and `references/runtime-internals.md` (~150 lines after the 2026-10-03
  `skill-drift` pass) holds runtime facts with natural homes in `src/` JSDoc, `AGENTS.md` or
  `ARCHITECTURE.md`. Move each entry to its home (the docs-server traps into `SERVER.md`; runtime
  facts into the JSDoc of the function they describe or `AGENTS.md` when they surprise an
  author); propose any `ARCHITECTURE.md` text in `NOTES.md` for the Architect. Then propose
  the two reference files cut to pointers plus whatever has no writable home, via
  `.agents-proposals/`. Keep `AGENTS.md` to non-obvious facts only.
  **Channel/tier:** none — guidance only.
  **Verification:** `check:links` green; no fact lost (each removed entry names its new home in
  the handoff).

  **Changed:** `.agents-proposals/skills/contributor/references/docs-server.md` — NEW full-file proposal: the reference cut to a three-line reading-order pointer (SERVER.md authoritative, TESTS.md, templates/README.md); every trap it held now has a writable home, so nothing is kept; `.agents-proposals/skills/contributor/references/runtime-internals.md` — NEW full-file proposal: the reference cut to a per-topic pointer (AGENTS.md Surprising Behaviors, ARCHITECTURE.md + ADRs, and the JSDoc file/function index); every fact it held now has a writable home; `server/SERVER.md` — absorbed the docs-server.md traps: `writeFileSafe()` write contract in Effects; the never-hand-edit note on Build Outputs; the Markdoc-tag checklist (schema in `server/schema/` → register in `markdoc.config.ts` → parse/transform/renderers.html+validate test → update this table + the writer skill's markdoc-tags reference) under Registered Schemas; the `[object Object]` symptom on the two-`html`-tags note and the `raw()`/escaping rule in Template System; the `guardPath(<directory>, path)` rule + config.ts constants on HTTP Server; `src/bindings.ts` — module JSDoc gains the map-form convention (ADR 0023): `function` declaration + two overloads + shared impl branching on `typeof`, never `Array.isArray` (negative narrowing doesn't exclude `readonly string[]`); nil/absent-key semantics per helper; `bindClass`/`bindState` need no `nil`; `bindProperty` is the partial-PATCH exception — don't generalize either way; `src/extensions/form.ts` — JSDoc gains: `formResetCallback`'s restoring write defers to a microtask (body comment holds the why) with the test consequence (`await Promise.resolve()` before asserting); `defaultValue`/`defaultChecked`'s native-input deviation (clean-control live-value update is unimplementable — dirty flag write-only); never put `value`/`checked` into `observedAttributes()` on a form-associated component (on both `formAssociated()` and `formAssociatedCheckbox()`); `src/helpers/reactive.ts` — `makeWatch` JSDoc: fixed stale "Returns an EffectDescriptor" → returns void (v3.0); the two unrelated registrations (pushDescriptor → activation timing, internal createEffect → cleanup owner); why `match()` without `createEffect` never re-runs; `watch(() => true, descriptor)` as the only registration path for a hand-authored descriptor's cleanup; a handler throw routes to `match()`'s `err` branch, never reaching connect containment. `makePass` JSDoc: Le-Truc-only scope with `watch(source, bindProperty(el, key))` fallback; `InvalidPassPropertyError` throws at activation (deferred, per-descriptor containment ADR 0028, factory cannot catch); atomic commit; `src/internal.ts` — `pushDescriptor` JSDoc: the collector registration (when a descriptor activates) is separate from the in-body `createEffect()`/`createScope()` registration (where its cleanup lives); `src/types.ts` — `isParser` JSDoc: detection is by brand, not structure; an unbranded look-alike gets no warning even in DEV_MODE — silently wrapped as a memo. `defineMethod` JSDoc: the function IS the method, installed as `host[key] = fn`; an unbranded `() => void` silently becomes a `MemoCallback`; `AGENTS.md` — two new non-obvious-fact bullets: form reset (deferred microtask restore from the `defaultValue`/`defaultChecked` baseline; `await Promise.resolve()` in tests; never `observedAttributes()` for `value`/`checked` on form-associated; the deliberate native-input deviation) and DEV-gated branch testing (env flip, no module mocking; `withDevMode` in `src/tests/context.test.ts`; process-global var, keep warn-count assertions in the flipping file).

- [x] LT-420: Task branches commit in the worktree at finish; the review pass integrates them (owner, 2026-10-03). — done ✓
  **Area:** server
  **Gates:** check:queue
  **Context:** owner ruling 2026-10-03: a run commits its task branch at finish, and the
  Architect's review pass — owner-attended — integrates approved branches. `scripts/worktree.ts`
  gains `commit` (stage exactly the handoff's Changed paths — the protected queue-store, kanban,
  NOTES and agent-config paths are refused mechanically, so churn and queue edits never ride — and
  commit unsigned) and `integrate` (clean-worktree check, a mergeable-status gate, a `--no-ff`
  signed merge into the main checkout's branch, then worktree and branch cleanup). Bootstrap sets
  worktree-local `commit.gpgsign=false` via `extensions.worktreeConfig` (owner-approved: task
  branches are local-only; the integration merge stays signed, and 1Password unlock is available
  because the pass is owner-attended). Both `do-task` ports run the commit after the annotate
  agent and before the queue annotate op, so the `⏳` suffix implies a committed branch; the owner
  handoff loses its commit/merge/cleanup steps. `review-pending` reviews committed branches
  (three-dot diff against the source branch), applies nits in the worktree as a `review:` commit
  on the branch, and returns a merge plan for the confirming session. Bootstrap reuse accepts a
  branch that carries commits beyond HEAD (rework continues it) instead of failing. The contract
  (`task-queue.md`, contributor skill) changes in the same commit as the scripts. LT-418 and
  LT-419 are the first tasks through the full pipeline.
  **Channel/tier:** none — tooling, no runtime check.
  **Verification:** `check:queue` and `test/queue.test.ts` green; a scratch task bootstraps,
  commits (a protected path refused, residue reported), and integrates; LT-418 and LT-419 land
  through do-task → review-pending → signed merges.

  **Changed:** `scripts/worktree.ts` (commit + integrate subcommands, best-effort worktree-local signing, rework branch reuse), `scripts/queue.ts` (`list [--status]`), both `do-task` ports (finish-step commit before the suffix flip; the Claude port re-verifies fix rounds as deltas), `review-pending` rewritten for committed branches in both runtimes (three-dot diff, nits committed on the branch, merge plan), `task-queue.md` + contributor skill in the same commits as the scripts.
  **How:** owner ruling 2026-10-03: a run commits its branch at finish (unsigned), the owner-attended review pass integrates (signed `--no-ff`). Proven live: LT-419 (done ✓, merged d86cbf6b), LT-418 (↩ → rework → merged 922f5d81 — the changes-requested and rework legs included), LT-387 (⏳ landed from a Claude Code run). Live-run defects fixed in-pass: relative `-F` path, `resolve` import, TS2345 on the message-file index, and the `.git/config` sandbox block (signing config is best-effort; the `-c` flag is the guarantee).
  **Check:** `check:queue` and `test/queue.test.ts` green throughout; every integration gate proved by use. The owner attended the build session and ruled each step, so this entry carries no separate ⏳ round.

- [x] LT-421: Fix the dead `workflows/improve-docs-architecture.md` citation in the writer's document map. — done ✓
  **Area:** docs
  **Gates:** check:links
  **Context:** `.agents/skills/writer/references/document-map.md:341` cites "see
  `workflows/improve-docs-architecture.md`", which exists nowhere in the repo — a repo-wide grep
  finds only this citation and the historical mention at `CHANGELOG.md:158` (a `tech-writer`
  workflow of that name); the live reference doc is
  `.agents/skills/writer/references/docs-architecture.md`. Point the citation at
  `references/docs-architecture.md` or drop it; propose via
  `.agents-proposals/skills/writer/references/document-map.md`. Fix it in the same pass as the
  LT-418 finding (4) — same line — when that rework lands.
  **Channel/tier:** none — guidance only.
  **Verification:** `check:links` green; no other dead pointer on the touched page.

  **Changed:** the fix rode LT-418's rework per the review's same-pass directive —
  `.agents-proposals/skills/writer/references/document-map.md` (merged on task/LT-418, 922f5d81)
  rephrases line 341 to queue-store language and points at `references/docs-architecture.md`.
  The owner's copy-in of that proposal discharges the `.agents/` fix; nothing further to do here.
