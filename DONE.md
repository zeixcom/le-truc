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

Struck 2026-10-07 (Architect, owner ruling: compiled CSS is platform CSS, ADR 0033 rewritten
and ADR 0048 s5 cut back; ITERATION ruling 14). Deleted without integration: LT-473, LT-475,
LT-499, LT-500, LT-405, LT-407, LT-408, LT-409.
- **LT-473** (approved, not integrated) built the ownership emission. Its measurements are the
  evidence behind ADR 0048's rejected style form. The lowered form cost up to about 13.5 kB raw
  per component, and native owners carried their rules twice. `test:variants` was green under
  it. Its branch and worktree were removed after LT-501's salvage of `css-probe-child`
  (2026-10-08).
- **LT-500's owner rulings that survive:** `{children}` directly in a child's root is allowed,
  with no wrapper, and own elements beside it are allowed and count as the parent's region
  (ADR 0048 s1). Components such as card-callout and section-menu are chosen partly for the
  styles they give their content. The platform model keeps that.
- **LT-409** asked for a ruling on each ADR 0033 s7 departure. The rewrite removes the
  emulation, so only inward reach and the lowered form's missing scope proximity remain.
  LT-405's `:host(X)` zero-specificity ruling (2026-10-02) is void: `:scope:is(X)` carries
  the platform's specificity.

---

Pruned 2026-10-06, seventh pass (Architect, after the "corpus port and pre-publish reshapes"
iteration closed; the `writer` recorded it in `CHANGELOG.md [Unreleased]` the same day).
Consumed: LT-109–LT-111, LT-186, LT-187, LT-277, LT-280, LT-305, LT-334, LT-342, LT-353,
LT-355, LT-356, LT-374, LT-375, LT-387, LT-390–LT-392, LT-411, LT-412, LT-414–LT-436,
LT-438–LT-447, LT-449, LT-451–LT-455, LT-468. Where their rulings live: ADR 0046 (s1–s7, as
amended by LT-429/LT-454), ADR 0047, ADR 0034 s1 (markers), ADR 0039; `HOST_PROFILE.md`
(per-item setup, per-field/scalar/key-alias harvest, list templates at the host's end, the
boundary's driver channels and one-catch-read rule, raw value source, unknown `truc:*`, markers,
LTC078); `errors.md` (LTC005's condition and arm/branch faces, LTC059–LTC080);
`VOCABULARY_LEDGER.md` (code skips, LTC079 released); `LE_TRUC_COMPILER.md` (sensor and
host-seed routing, source-ordered client setup); `src/helpers/reactive.ts` (`reconcile()`:
insert-before-mount, per-Mount-Scope containment) and `src/errors.ts` (`reportScopeFailure`);
`analysis/loops.ts` (LTC074, `data-key` no exemption); `glob.ts` + SERVER.md (explicit-dot
segments, `/api/status`, HMR-free mock fragments); `scripts/lib/baseline.ts` and
`check-baseline.ts` (author code reported, not judged); `simulation/contract.ts` (seam revision
2); the module docs of `module-lazyload.tsx`/`.ts`, `module-cem-list.tsx`, `_common/reorder.ts`
and `examples/main.ts` (sanitizer policy, `on*` excluded); `task-queue.md` (commit/integrate
flow); AGENTS.md; and the notes below. Open handoffs: LT-469 (its "LT-111 ruling 5" now
means the twin bullet below), LT-078 (the boundary's corpus consumer is module-lazyload,
LT-449; arm-adoption audit LT-390), and LT-448, LT-456, LT-457, LT-458, LT-459, LT-470, which
restate what they need. LT-246, LT-437 only `needs:` consumed IDs.

**Rulings carried from the 2026-10-06 prune** (recorded nowhere else; do not re-litigate):
- **A twin follows the compiled page; it is never deleted** (ITERATION ruling 5, LT-110,
  LT-449). Every example folder is served compiled and the `.ts` twin stays as a variant. A
  migration regenerates the authored `.html` from the compiled render; the result need not
  match the old fixture byte for byte (owner, 2026-10-06), but the twin must enhance it. When
  the compiled surface owns the DOM (an arm set), the twin is rewritten to consume the compiled
  page through public `reconcile()`. Rejected: deleting the twin, per-surface page shapes,
  surface guards in the spec (the last two break ADR 0039 s2). ADR 0039's "the twin stays
  byte-for-byte the artifact of record" yields to this. Shared helpers serve the *compiled*
  surfaces; the twin keeps its inline logic (LT-111).
- **Acceptance criteria are goals, not constraints to meet by workaround** (ITERATION ruling
  10, owner). A spec or golden that encodes a twin's latent bug is reported with evidence and
  ruled (fix the twin or change the expectation), never matched silently.
- **List-template placement: comment anchors rejected (minifier robustness), computed positions
  rejected (fragility)** (ITERATION ruling 16, LT-454). Not in ADR 0046's alternatives.
- **LTC074 is an error, not a warning, and LT-185's runtime half stays a DEV_MODE advisory**
  (LT-186). A deliberate deviation from ADR 0028's Prevented pairing: do not convert the
  advisory to `console.error` and do not retire it. The compiler cannot see consumer-authored
  HTML.
- **No cleanup ambient for per-item effects** (LT-280): `watch` handler cleanups already run
  before removal.
- **`expose({ value: harvest(…) })` stays LTC005** (LT-443): a plain-value prop's client seed
  is evaluated once and cannot parse a DOM read. Allowing it is a new feature, not a new
  spelling.
- **A generated module's header cites no internal ADR** (LT-414). It keeps only the milestone
  wording.
- **Mount-Scope addressing limits accepted** (LT-424): a host-level `first()` keeps LTC007
  without child-path synthesis, and the synthesized `:scope >` child path skips the
  composed-children exclusion (a step names an own tag).
- **A key alias behind an arm set, a server-data loop or a composed child is LTC005, not
  LTC080** (LT-453). This narrows ADR 0047 s3's "across all enclosing scopes" to enclosing list
  items, under the ADR's "wider forms wait"; LT-456 holds the widening.
- **A key-alias field with no parser or only a formatted site keeps LTC076/LTC059** (LT-453):
  "with s7's parsers and raw-source rule" reuses s7's codes; LTC080 covers only the four s1
  conditions.

**Open obligations added** (check before closing the named work):
- **Known compiler gaps, deliberately unfiled:** dependents of an `unresolvable` signal stay
  server-known, and a `deriveList` over one iterates the `refStub` value; sensors share this
  gap (LT-451). Synthesized harvest declarations drop type arguments (LT-451). A Simulated host
  signal excluded from the retention pool (LT-165 step 5) leaves an item const with a dangling
  name — loud as TS2304, never a silent runtime error (LT-447). The harness's
  `deriveList(source, itemFn)` does not run async item callbacks (LT-425).
- **`form-inplace-edit.css`'s `&[editing] .text { display: none }` is dead** since the arm
  swap. Drop it in the next CSS pass (LT-390).

---

Pruned 2026-10-03, sixth pass (Architect, after the first `release-notes` run recorded
LT-370, LT-371 and LT-378 in `CHANGELOG.md [Unreleased]` and found LT-335 and LT-410 covered,
LT-373 and LT-393 internal). Consumed: LT-335, LT-370, LT-371, LT-373, LT-378, LT-393, LT-410.
Where their rulings live: `sim/realm.ts` § Attribution (LT-335), ADR 0044 s1 and LT-254's entry
(LT-370, LT-371), `do-task.js`'s commit step (LT-378's bundle-churn note), and the notes below.
Its open handoffs (LT-411, LT-414, LT-416) were consumed by the seventh pass.

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
  `module-todo.spec.ts` and `form-tokenbox.spec.ts`, in en and de (the example components; the
  docs are English only). The owner confirms they are green before the next PR (LT-252, LT-354).
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
- **No compiler-stamped hash class for addressing** (LT-096): page-authored occurrences never pass
  through the compiler's render, so a stamped hook would be absent where the enhancer binds. The
  `:not(<tag> *)` exclusion is accepted; its only miss is an own element inside a same-tag
  ancestor of the host, which no composition produces.
- **Scrollarea's wall time at demo scale is noise** (LT-103).

- [x] LT-093: Make LTC004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall). — reviewed ✓
  **Area:** compiler
  **Area:** compiler
  **Context:** LTC004 fired "no harvestable initial-DOM site" for a signal that IS rendered
  through a thunk when its initializer read a plain setup const or an import, so the component
  tiered Simulated with no warning (ADR 0029). The task absorbed LT-135 (a predicate hoisted
  into a setup const un-credited its signal).

  **Changed:** a thunk-rendered signal now reuses an initializer that reads plain setup consts
  (transitively) or authored imports. The client already placed those names: a signal
  declaration is a client position in `computeClientNeededNames`, so only the harvest gate
  (`substituteArgExpr`) refused them. That gate is now `unportableNames` in
  `analysis/harvest.ts`. A server arg counts as portable only at the initializer's top level.
  When the initializer still cannot be reused, the LTC004 census detail names its free names
  instead of claiming no site. The harvested client declaration keeps its authored type
  arguments (`createTask<string>(…)`; `typeArguments` in `emit-client.ts`). form-combobox
  (`.tsrx` and `.tsx`) hoists its popup predicate into `const isOpen`; the workaround comment is
  gone. Corpus effect: **module-lazyload moves from Simulated to Folded.** Its only routing
  signal was this false firing. Its served HTML is unchanged (both tiers serve the pending arm),
  and the equivalence audit records its nil→err connect diff. Tests:
  `server/tests/compiler/initializer-portability.test.ts` (const, const chain, import, type
  arguments, `.tsx`, the LT-091 `plainLocalNames` reactive-thunk leg, the routing-reason
  wording). `tier-corpus.test.ts` and `host-seeded-signal.test.ts` are updated.
  **Already landed before this task (verified, not redone):** the LT-135 half, through LT-323's
  `carriedBy`, with the negative case already flipped in `client-setup-credit.test.ts`; and the
  `returnsNumber` number-signal coercion (LT-126, `dirty-flag-dispatch.test.ts`).

  **Review:** Approved. Ruling: folding a component whose only async state is a `Task` is the
  intended tier. The server renders the nil arm, which is what the client shows until the task
  settles, so the realm bought nothing. The reviewer ran the unrunnable gates outside the
  sandbox: `test:variants form-combobox` (tsrx 60, tsx 60) and `test:variants module-lazyload`
  (ts 40, tsx 40), all green.

- [x] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding). — reviewed ✓
  **Area:** compiler
  **Context:** A `@for (const x of items)` loop lowers CLIENT-side to
  `const items = all('<selector>')` — the loop's collection name becomes a query variable that
  SHADOWS the server arg of the same name. Setup or `expose()` code reading the arg then means
  two different things per half: server `items.length` is the array length, client
  `items.length` is `undefined` on a `Cell`. **Verified 2026-08-30, and it is loud:**
  `expose({ n: () => items.length })` over a `@for (const item of items)` loop compiles with
  ZERO compiler diagnostics but fails `check:tsrx` with `TS2339: Property 'length' does not
  exist on type 'Cell<HTMLSpanElement[]>'`, mapped back to the right `.tsrx` line. So this is a
  message-clarity task, not a correctness hole — same posture as LT-125. The tsc text names
  `Cell<…>` but never says *why* the author's `string[]` arg became one, and the fix (rename the
  loop binding, or project the value through `expose()`) is not discoverable from it. **Re-verify first (Architect, planning 2026-10-06):** the entry predates ADR 0046 (reactive
  lists) and `.tsx` as the default surface. Before changing anything, check whether a
  server-data `@for` still lowers its collection name to a client `all()` query that shadows the
  arg, on either surface. If neither surface still shadows, close the task with `done` and a pinning
  test. If one does, the diagnostic is **LTC082** (compiler, tier 1 Prevented, statically
  decidable; no runtime half).
  **Fix:**
  detect the collision in the compiler — a `@for` collection name that also names a server arg,
  where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the
  shadowing and the rename. Low priority: no corpus component hits it, and the build already
  stops.

  **Changed:** Re-verified on both surfaces: the loop's collection name still lowers to a client `const items = all(…)`, but a client position reading the same-named server arg is already refused before tsc (LTC005 server-only name, naming the arg; a setup `on()` reading it is refused at the statement). The tsc `TS2339` no longer occurs, so no LTC082 was added; pinned in `for-collection-shadow.test.ts`.
  **Review:** Approved (2026-10-07), closed with a finding (ruling 9). The shadow still lowers, but LTC005 refuses the client read before tsc, naming `items` in the `expose()` case. That makes the fix discoverable, which was the goal of the entry. LTC082 is released unused.

- [x] LT-282: `docs-src/api/_media` mirrors have no refresh path (LT-272 residue, unfiled until the LT-179 review). — reviewed ✓
  **Area:** server
  **Context:** `_media/*.md` inside the gitignored TypeDoc output dir are hand-copied mirrors
  of repo docs (`REQUIREMENTS.md`, ADRs). No build generates or refreshes them, so they go
  stale silently and freshness depends on somebody remembering (LT-272 hand-refreshed them
  once; the gap was left unfiled). Decide: generate the mirror in `build:docs` from the repo
  sources, or delete it and link the repo files instead. **Probe first (Architect, planning 2026-10-06):** the premise may be wrong. `docs-src/api/` is
  TypeDoc's `out` dir (gitignored), and TypeDoc copies relatively linked local files into `_media`
  when it runs. Find out whether `build:docs` runs TypeDoc and whether a run refreshes `_media`.
  If it does, close the task with `done` and a one-line finding. If it does not, prefer deleting
  the mirror and linking the repo files (fewer moving parts) unless a link target cannot be
  reached from the published site, and record which one you chose.
  **Channel/tier:** none — build pipeline.
  Filed while its staleness was
  re-observed during the LT-179 review.

  **Closed (Architect, 2026-10-07; owner ruling):** premise wrong — everything inside `docs-src/api/` is TypeDoc output or files TypeDoc copies (relatively linked local files land in `_media` on each run), so the mirrors are not hand-kept. No mirror to generate or delete; no change.

- [x] LT-437: Refresh the `cause-effect` skill for 1.6 — version stamp, list `map`/`forEach`, derived-list `stale` (LT-412 review follow-up). — reviewed ✓
  **Area:** docs
  **Needs:** LT-412
  **Narrowed (Architect, planning 2026-10-06):** b63fbfed restamped `skills/cause-effect/` to
  1.6.x and covered list `map`/`forEach` and the derived-list `stale` case. What is left: the
  `stale` bullet in `skills/le-truc/references/runtime.md` ("never fires for a cell or memo", no
  derived-list case) and the matching last bullet of `AGENTS.md` ("only fires for `Task` signals").
  Bring both in line with `skills/cause-effect/SKILL.md`'s `stale` bullet, which is verified
  against 1.6.1. The original context follows.
  **Context:** `skills/cause-effect/SKILL.md:6` still says it describes 1.5.x (verified against
  1.5.2). LT-412 corrected the `stale` routing for 1.6.1, but the rest of the skill was never
  checked against 1.6: 1.6.0 added `map((item, key) => R)` and `forEach` to both list kinds (the
  `.tsx` keyed map, ADR 0046 s4, relies on them), and in 1.6.1 a list or store derived from an async
  computation can reach `stale`. `skills/le-truc/references/runtime.md`'s `stale` bullet still says
  "never fires for a cell or memo" and omits the derived-list case. Verify each claim against the
  installed `node_modules/@zeix/cause-effect/src/`, add only what a Solid/Preact user would get
  wrong (the skill's own rule), and restamp the version.
  **Channel/tier:** none — docs.
  **Check:** every behavioral claim in both files traces to the 1.6.1 source; the stamp names 1.6.x
  and the version verified.

  **Changed:** `skills/le-truc/references/runtime.md` and `AGENTS.md` `stale` bullets name the derived-list/store case (verified against 1.6.1 `collection.ts`/`store.ts`), aligned with `skills/cause-effect/SKILL.md`; CHANGELOG skill line extended.

  **Checked (Architect, 2026-10-07):** the new claim traces to 1.6.1. A derived list (`collection.ts:985`) and a derived store (`store.ts:696`) register their internal Task through `registerAsyncSource`, and `isPending()` resolves through that map (`graph.ts:932`). The three wordings agree: AGENTS.md, `skills/le-truc/references/runtime.md` and `skills/cause-effect/SKILL.md:45`.

- [x] LT-460: A compose site in an async-boundary arm — lower it as arm root, keep the arm binding in its children. — reviewed ✓
  **Area:** compiler
  **Gates:** check:corpus, test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from a composition probe for LT-463; owner: both are bugs):**
  (1) a compose site as an arm root (`pending={…}`, `catch={e => …}`, `.tsrx` `@pending`/`@catch`/`@if`
  bodies) was refused with a stale LTC011 message naming "`.map()` output"; (2) a catch-parameter read
  in a compose site's children compiled with no diagnostic into a server module that read `e` outside
  the catch callback (TS2552 under `check:corpus`, ReferenceError at execution).

  **Changed:** Compose sites are legal in arm positions on both surfaces. An arm root that is a compose
  site lowers as one, and its `data-key` splices onto the child's rendered root through
  `composeHostAttrs`, for reactive conditionals and async boundaries, in both the live arm and the inert
  templates. A catch-parameter read inside composed content (one compose hop) is in scope in the live
  arm, baked empty in the err template, and rewritten by the client's err watch through an arm-scoped
  `first()`. LTC011's composed-position wording now names a loop's output root. New LTC005 refusals
  (compiler, tier 1): a compose **arg** reading the catch parameter; a bare-tag message element inside
  composed content (it needs a `role`, `class`, `id` or `data-*`, since the child's own markup could
  match a bare tag); a reactive read placed directly in composed content (fix-it: wrap it in an element
  of your own). The pending arm keeps its deep-construct refusal. Documented in
  `server/compiler/HOST_PROFILE.md` (compose-arm paragraph) and `LE_TRUC_COMPILER.md`.

  **Review:** Approved after two rework rounds. Round 1 fixed: a bare-tag selector miswrite, dead
  `armValue` code, wrong fix-it advice for composed content, and a missing reactive-`@if` compose-arm
  test. Round 2 fixed: a pending-arm deep-construct regression introduced by round 1, and the
  message's missing `data-*` mention. Rulings: an ok-arm compose root stays refused (composed content
  cannot carry the task read); item/key reads in composed content stay LTC075; the LT-221 probe pin
  ("compose site in a `@pending` arm is rejected") is overruled.

- [x] LT-461: Handler args — an `on`-prefixed function arg the child places on an owned element lowers to a parent-side `on()`. — reviewed ✓
  **Area:** compiler
  **Gates:** check:corpus, test:server
  **Area:** compiler
  **Ruled — pickable (Architect, planning 2026-10-06):** the design below is the owner's ruling; the
  task is implementation, not a session. LTC081 is reserved for rule 6.
  **Filed (Architect, 2026-10-06; design by the owner, 2026-10-06):** today `onClick` on
  `<BasicButton>` is forwarded as a server arg into `renderBasicButton({ …, onClick })` and dropped:
  no listener exists anywhere. In a reactive-list item it is misdiagnosed as LTC075.
  **Design (owner):** a handler is an ordinary server arg — never exposed, never stored on the
  host, never a reactive property. The child declares delegation by placing the arg on an owned
  raw element:
  `export function BasicButton({ type = 'button', onClick, … }: { onClick?: (e: MouseEvent) => void; … })`
  with `<basic-button><button {type} {onClick}>…</button></basic-button>`. The parent's compose site
  `<BasicButton class="remove" onClick={e => items.remove(k)} />` lowers in the parent's client to
  `on(first('basic-button.remove button'), 'click', e => items.remove(k))`.
  **Rules:**
  1. **Which args:** a parameter whose name matches `on[A-Z]…` and whose declared type is a function
     type, read syntactically from the child's parameter annotation (no checker).
  2. **The event comes from the placement, not the arg name:** `onPress` placed as
     `<button onClick={onPress}>` delegates `click`.
  3. **Server:** the child's render never emits the arg (no attribute, no serialization); the
     child's client emits nothing for it. Page-authored instances simply carry no handler.
  4. **Selector:** the compose site's tag-plus-discriminator selector (LT-127/LT-338), joined with
     the placement element's selector from the child's template, proven unique by the structural
     verifier (ADR 0045). The compiler synthesizes it; an author never writes it, so it is no
     reach-in (HOST_PROFILE § data account, bullet 3): the child's signature is the contract.
  5. **Scope:** the `on()` emits into the compose site's enclosing Mount Scope — host, arm
     (`bindArm`), list item (`bindItem`) — so item/key reads are legal; LTC075 exempts handler args.
     The `on()` return-value contract applies to the **parent's** host (`{ prop: value }` batches
     into the parent), as for any parent handler.
  6. **Placements the parent cannot address are refused** in the child (new **LTC081**, tier 1
     Prevented, compiler; statically decidable, no runtime half): a handler arg placed anywhere but
     as an event attribute on a raw element; inside one of the child's reactive arms or list items
     (recreated on flip or reconcile, so the parent's `first()` would go stale); or an `on[A-Z]` arg
     whose type is not a function type. Several placements of one arg emit one `on()` each.
  7. **Forwarding:** a child that passes its handler arg on to its own compose site
     (`<Inner onClick={onClick} />`) resolves through the registry to the inner placement; the
     selector descends through both boundaries.
  8. **Typing:** on `.tsx`, compose-site handler args typecheck as ordinary props; an undeclared
     `onX` stays the existing tsc excess-property error. `.tsrx` parity on the same IR.
  **Then:** `BasicButton` gains `type?: 'button' | 'submit'`, `ariaLabel?: string` (rendered as
  `aria-label`) and `onClick?: (e: MouseEvent) => void`, placed on its native button.
  **Verification:** test:server unit legs (host, arm and list-item compose sites; forwarding; each
  LTC081 case; return-value batching into the parent); check:corpus; a Playwright leg on a
  converted list remove button.

  **Changed:** handler args (LT-461). A child arg named `on[A-Z]…` with a function type, placed as an event attribute on an owned raw element, emits nothing on either half of the child. Its placement is published on the registry entry as the new optional `RegistryEntry.handlerArgs` (`HandlerPlacement`). A parent compose site's `onX={…}` (new `ComposeAttrIR` `handler`, never a server arg) lowers to one `on()` for each placement, in the site's Mount Scope: host factory queries, list-item locals, arm-root and arm-descendant locals. The selector is the site's tag plus discriminator, joined with the child-proven placement selector. Forwards (`<Inner onClick={onClick} />`) resolve recursively through the registry. New LTC081 (not a function type / a read outside a placement or forward / inside a reactive arm or list item / inside a server-data loop body) runs in the shared front end on both surfaces. `BasicButton` gains `type`, `ariaLabel` and `onClick`. `test-listitem`'s remove button is now `<BasicButton onClick={() => items.remove(k)} />`.
  **How:** `params.ts` reads handler args syntactically: an inline literal, a same-file alias or interface, or an intersection. `classify-attributes.ts` adds `handler-arg` (raw) and `handler` (compose). `validate-lowered.ts` adds `reportHandlerArgPlacements`. New `analysis/handler-args.ts` holds the child placements and the parent resolution. Placement selectors are proved with every composed child's markup taken as unknown, because the parent reads the discovery-pass entry, so they fall back to `:scope >` paths when the child composes anything. In `effects.ts`: `planHostComposeHandlers`, item `collectCompose`, `planArmRootComposePass` and `planArmComposeHandlers`, plus a backstop (`reportUnplannedHandlers`, LTC005) so no handler drops silently. Also: placements in server-rendered branches are `optional` (non-throwing query); `reportServerOnlyNames` skips handler args (LTC081 owns that read); the host profile's event attributes accept `undefined` (needed under `exactOptionalPropertyTypes`). Docs: HOST_PROFILE § Handler args, LE_TRUC_COMPILER inventory and module map, VOCABULARY_LEDGER, `skills/le-truc/references/errors.md`.
  **Check:** `bun test server/tests/compiler/handler-args.test.ts` (17 tests: host, arm root and descendant, item, forward, batching, optional, refusals) and the 5 LTC081 parity cases in `tsx/diagnostic-parity.test.ts`. Gates green: test:server (3519/0, after build:docs), typecheck, check:contract, check:corpus, build:docs, check:links, biome on touched paths. Unrunnable in the sandbox: `test:component test-listitem` (browser launch timeout, every test including the untouched `.tsx` ones), and so `test:variants` and Playwright. The new legs in `test-listitem.spec.ts` (remove an adopted item, remove a clone) need an owner run. Doubts for review: (1) The in-loop LTC081 and the LTC005 for loop or unmounted compose sites go beyond rule 6's list. (2) `module-todo`'s remove button is not converted: it needs `tertiary destructive small`, and `variant` cannot express that. That needs a ruling on a variant shape (follow-up). (3) `HandlerPlacement` is reachable from the public `RegistryEntry` but not exported from `contract.ts`. (4) The return-value batching leg is asserted textually (the parent factory's own `on`), not run. (5) LTC081 copy may want a `writer` pass.

  **Review:** Approved. Rulings on the doubts: (1) both extensions ratified — the in-loop LTC081 and the parent-side LTC005 backstop (a compose site in a server-data loop body or where no mount binds it, including a server branch inside an arm) follow from the same unaddressability rule 6 already states, and match the LT-468/LT-470 refusals for constructs and passes in the same positions; nothing drops silently. (2) Filed as LT-489 (BasicButton modifier shape + the module-todo conversion, recommendation: boolean modifier props) — conversion was never this task's scope. (3) Fixed in review: `HandlerPlacement` is now exported from `contract.ts` beside `RegistryEntry` (the `ExposeKind` precedent) and pinned (`c96e01fe`). (4) Accepted: the browser legs prove the parent-side binding end to end, and return-value batching is the unchanged `on()` runtime contract with existing src/tests coverage. (5) Copy accepted as-is; a writer sweep can take LTC081 in a later copy batch. The branch was stale (base 54ebe444, five v3 commits behind); the reviewer merged v3 into the branch (`edc1ae43`) — the 3 serve.test failures on the merged state were the worktree's pre-LT-469 generated clients, gone after `check:corpus` rebuilt them, no conflict. Gates re-run on the merged state, all green: test:server 3533/0, check:corpus, typecheck, check:contract (with the new pin), build:docs, check:links. The browser legs the contributor could not run: `test:component test-listitem` 20/20 in Chromium + WebKit, including both new removal legs. The entry's gates line named only check:corpus and test:server; the rest the contributor ran as insurance and the reviewer repeated.

- [x] LT-462: Children contract — parent-owned children, child-declared roles and content model (design; ADR 0048). — done ✓
  **Area:** design
  **Needs:** LT-465
  **Area:** design
  **Filed (Architect, 2026-10-06; owner rulings 2026-10-06):** composing `<ModuleScrollarea>` around
  `module-codeblock`'s `<pre><code>` fails LTC026 — the structural verifier excludes everything
  under a composed child (`:not(<child-tag> *)`, LT-316) — and ADR 0033 s7 leaves content a parent
  places inside a composed child outside the parent's style scope.
  **Owner rulings:** (a) content a parent passes as `children` is owned by the parent. (b) A child
  may act on its children through its contract (first raised for `BasicPluralize`, since retired
  in LT-467; `<select>`/`<option>` is the standing analogue).
  (c) `FormCheckbox` takes its label as `children` and refuses interactive content in it. (d) The
  CSS boundary consequence is decided by a spike first (LT-465).
  **Model to record in ADR 0048:**
  1. **Parent owns the content** — structure, text, its own bindings and `first()` references reach
     the children region; the verifier excludes only the child's own template.
  2. **The child acts only through declared roles** — its `children` type names the roles it
     addresses (sketch: `children: Children<{ tab: 'button', panel: 'section' }>`, roles matched by
     class), as `<select>` acts on `<option>`. A child `first()`/`all()` into children that targets
     no declared role is a reach-in (new LTC, tier 1).
  3. **One writer per property** — a parent binding a property the child's contract writes on a role
     element is a conflict (new LTC, tier 1, decidable from the compose registry).
  4. **Content model** — a child may declare its children non-interactive; the compiler checks the
     compose site's literal children (`a[href]`, `button`, `input`, `select`, `textarea`, `label`,
     `details`, `iframe`, `[tabindex]`, media with `controls`) and composed children whose template
     contains one, transitively through the registry (new LTC, tier 1). TypeScript cannot carry it
     (JSX element types are opaque); page-authored HTML is unchecked.
  5. **Styles** — per LT-465's recommendation.
  **ADR edits riding with 0048** (none of these is published on `main`, so all are in-place
  amendments): ADR 0024 s10 (children ownership; cross-reference), ADR 0033 s7 (the
  "template-authored content in a composed child" difference, per LT-465), ADR 0046 (point 1's
  verifier change inside list items), HOST_PROFILE § data account bullet 3 and § element references.
  **Output:** ADR 0048, then compiler tasks per numbered point with channel, tier and LTC codes,
  plus the two composition sites split out of LT-463 (owner, planning 2026-10-06):
  `module-codeblock`'s `<module-scrollarea>` → `<ModuleScrollarea>`, and `module-todo`'s
  `<form-checkbox>` → `<FormCheckbox>` with its label as children (point 4's content model; after
  LT-464 gives form-checkbox its `.tsx` spelling).
  **Changed:** ruled 2026-10-06 (owner design session) into ADR 0048. ADR 0024 s10, ADR 0033 s7
  and ADR 0046 s1 were amended in place, and CONTEXT.md gained **Children Region** and **Role**.
  The implementation is track C: LT-472 to LT-479 (ITERATION ruling 10).

- [x] LT-463: Compose sub-components instead of raw custom-element markup in the compiled corpus. — reviewed ✓
  **Area:** examples
  **Needs:** LT-460, LT-461, LT-466, LT-467, LT-485
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, owner request):** several `.tsx`/`.tsrx` sources author a
  child component's markup by hand (`<basic-button><button>…</button></basic-button>`) instead of
  composing it (`<BasicButton … />`), duplicating markup the child owns. Composition is allowed
  to be raw, but the corpus should model ownership: the child's template renders its markup, the
  parent passes args, `class` discriminators and `truc:pass`. Convert each site below in every
  variant-set member (`.tsx` and `.tsrx` twin together; CSS must stay byte-identical, ADR 0039);
  the `.ts` twins are hand-written runtime sources and stay as they are.
  **Sites:**
  - `module-lazyload` — pending/catch callouts → `<CardCallout>` / `<CardCallout kind="danger">`
    (needs LT-460).
  - `module-dialog`, `module-splitview` — `<module-scrollarea>` → `<ModuleScrollarea>`; no parent
    reference into the children, so unblocked. The dialog opener stays a raw `<button>` (its
    documented reason stands).
  - `module-ticker` — toggle and add-rows → `<BasicButton>`; handlers become
    `onClick` args (LT-461).
  - `module-list`, `module-todo` — submit buttons and list-item remove buttons → `<BasicButton>`
    with `type`, `ariaLabel` and `onClick` args (LT-461). `module-todo`'s clear-completed → `<BasicButton>` with its
    existing `truc:pass`.
  - `module-todo` — `<form-radiogroup>` → `<FormRadiogroup name legend options value>` with
    `class="split-button"`.
  `module-catalog`, `module-cem-list`, `form-inplace-edit` and `card-mediaqueries` mention a tag only
  in prose.
  **Split (owner, planning 2026-10-06):** the two sites that need the children contract —
  `module-codeblock`'s `<module-scrollarea>` and `module-todo`'s `<form-checkbox>` with its label as
  children — moved to LT-462's implementation tasks. Leave both raw here. `module-todo` is touched
  after LT-466 and LT-467 land, so the three edits to it run in sequence.
  **Rule for surprises:** a site whose conversion needs a child-contract change not listed here,
  or changes the rendered DOM or a spec's expectation beyond the composed root's attributes,
  stays raw and goes into `NOTES.md` for a ruling — do not extend a child's contract ad hoc.
  **Verification:** check:corpus, test:variants, and the touched components' Playwright specs.

  **Changed:** Converted the listed corpus sites from hand-authored child markup to composition: module-lazyload's pending/catch callouts are composed `<CardCallout>` / `<CardCallout kind="danger">` arm roots (the LT-460 shape); module-dialog's content pane composes `<ModuleScrollarea>`; module-ticker's toggle and add-rows controls and module-list's and module-todo's submit buttons are composed `<BasicButton>`s with `type`/`variant`/`label`/`onClick` args (LT-461), keeping their existing `truc:pass` entries. Every site was converted in both variant-set members (`.tsx` + `.tsrx`); the `.ts` twins are untouched and no CSS changed (variant assertion held).

  **How:** Compose-site children splice into the child's rendered DOM (LT-018): the dialog's `<form>`/`.content` and the lazyload arms' `<p>` elements travel as the child's `children` arg, and each composed arm root carries the arm's `data-key`. The toggle keeps its reactive label via its existing pass and passes `label="⏸️ Pause"` as the server-render seed; module-todo's submit passes `t.addTodo` as the label arg (server-resolved per render locale) beside the static `disabled` seed and its `disabled` pass. Sites whose conversion hit the task's surprise rule stay raw with in-source comments pointing at the ruling they need: module-list's and module-todo's remove buttons and module-todo's clear-completed (`tertiary destructive [small]` is not expressible through BasicButton's props — LT-489), module-todo's filter radiogroup (the composed render cannot carry the page-level `visually-hidden` presentation on the legend and radios, and LTC071 forbids the parent styling the child's internals), and module-splitview entirely — `<div truc:html={start}/>` inside composed `<ModuleScrollarea>` children is LTC011-refused ("`html` attribute in a composed element's content is not supported yet"), so a markup-valued string arg has no composed-children channel; the conversion was reverted from this commit. One compiler gap surfaced and was worked around authored-side: a setup const read only by a handler-arg body is dropped from the generated client (setup-extraction does not walk handler-arg bodies; TS2304 on the authored file) — module-ticker's `ALPHA` moved into the add-rows handler, gap recorded in NOTES.md for a compiler follow-up.

  **Check:** `check:corpus` green (exit 0, 41 components; the census and tier notes are unchanged from before). `test:variants`: 535 passed, 2 failed — both pre-existing section-menu failures ("closes when a menu link is clicked", Chromium + WebKit, all three surfaces), proven identical on a clean tree via `git stash` (LT-469 residue, not this branch). Touched components' Playwright specs all green: `test:component module-lazyload` 40, `module-dialog` 43, `module-ticker` 8, `module-todo` 60 (module-list has no spec; module-splitview's sources were reverted so its artifacts are unchanged). Biome clean on every changed `.tsx` path (biome does not format `.tsrx`). For the review pass to rule on or file: (1) a composed-children `truc:html` channel or a markup-valued prop for ModuleScrollarea (splitview); (2) the FormRadiogroup presentation contract (visually-hidden on legend/radios); (3) the handler-arg / setup-extraction gap as an LT-461 follow-up compiler task — with LT-489 already covering the modifier-combo shape.

  **Review:** Approved. Every converted site renders the old markup. Ticker's two `onClick` handler args bind to distinct host-class selectors (`basic-button.toggle button`, `basic-button.add-rows button`). BasicButton's `secondary medium`/`constructive medium` inner classes are style-neutral (`secondary` is the default look, and `medium` has no rule). The empty badge span hides through `.badge:empty`. The lazyload arm roots keep `data-key` in the server output. Dialog and lazyload have no `.tsrx` twin, so the `.tsx`-only edits are complete. Reviewer nits: module-dialog's header no longer lists the ModuleScrollarea composition as a "difference" from the page (it isn't one), and module-lazyload's header is reflowed. Re-run: check:corpus green; `test:component module-dialog` 43/43 and `module-lazyload` 40/40, outside the sandbox (in the sandbox every Playwright spec times out in `beforeEach`, untouched basic-button included). Residues ruled with the owner (2026-10-07): (1) splitview — lift LTC011 for `truc:html` in composed children (ADR 0048 s1), filed LT-492 → LT-493; a markup-valued prop is rejected. (2) The radiogroup — the child's `.split-button` variant hides its own legend and radios, filed LT-494. (3) The handler-arg setup-extraction miscompile, filed LT-490. The remove and clear-completed buttons remain LT-489's. The section-menu failure at base is filed as LT-491.

- [x] LT-464: form-checkbox gains a .tsx spelling. — reviewed ✓
  **Area:** examples
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, owner request):** add `form-checkbox.tsx` beside the `.tsrx`
  as a variant-set member (ADR 0039). It becomes the served surface, keeps the `label: string`
  arg (the children switch lands in LT-463), and the `.tsrx` twin stays.

  **Changed:** `examples/form/checkbox/form-checkbox.tsx` is added: canonical tag, its own
  `HTMLElementTagNameMap` entry, byte-identical CSS, and a `FormFactoryContext<FormCheckboxProps>`
  second parameter. It is now the served surface. The host profile
  (`server/compiler/frontend/tsx/host-profile.d.ts`) gains `name`/`checked` on
  `FormCheckboxAttrs` and `disabled` on the `input` intrinsic. Both members declare
  `'truc:pass'?: { checked?: … }` on their args type, as form-listbox's members do, so the
  parity render signatures stay identical. `examples/test/listitem/test-listitem-tsx.tsx` now
  composes the `.tsx` member, which pins a typed `.tsx`→`.tsx` pass. The parity snapshot gains
  the form-checkbox `.tsx` client.

  **Review:** Approved after one rework. The rework was owed because the examples tsc program
  (`tsx/typecheck.test.ts`) failed on the profile attrs and the missing pass key, and
  test-listitem-tsx still imported the `.tsrx` (owner flag). The twin's matching `'truc:pass'`
  key is accepted. The reviewer ran the browser gates outside the sandbox: `test:variants
  form-checkbox` (tsrx 40, tsx 40) and `test:component test-listitem` (18), all green. The tsx
  typecheck suite passes 4/0.

- [x] LT-465: Spike — style scope for parent-owned children inside a composed child. — reviewed ✓
  **Area:** compiler
  **Area:** compiler (spike — no production change; output is a report)
  **Filed (Architect, 2026-10-06, owner ruling (d) in LT-462):** under parent-owned children the
  parent's rules should reach the content it passes into a composed child, and the child's rules
  should not (beyond declared role elements' own boxes). ADR 0033 s3 emits
  `@scope (parent) to (<boundary> > *)`, which cuts off everything below the child host —
  children included, wherever the child's template inserts them (`<pre><code>{children}</code></pre>`
  puts them two levels deep). A `to` limit cannot re-include a subtree it excluded.
  **Probe these shapes, both emissions (native `@scope` and lowered `:where()`), self-nesting
  included (ADR 0033 s7's `A > B > A′`):**
  (a) **A second scope root at the insertion point:** the server marks the element enclosing a
  `{children}` insertion (sketch `data-children`), and the parent's sheet emits once more as
  `@scope ([data-children]) to (<boundary> > *)`, guarded to the parent's own instances — cost:
  doubled rules, the marker attribute in served HTML, the instance guard.
  (b) **A `display: contents` wrapper element** around inserted children, as the scope root of (a)
  without marking a template element — cost: a non-semantic element in the DOM, child selectors
  (`:host > p`) that now miss.
  (c) **Status quo plus `:global`** — children stay outside the scope; record what ownership then
  means for styles only.
  For each: which rules match, specificity parity between emissions, served-byte cost on the
  corpus's composing components, and the child-side half (the child's own `to` limit must now stop
  at the insertion point). Also confirm the structural verifier change (LT-462 point 1) composes
  with the chosen marker.
  **Output:** a recommendation with fixtures under `server/tests/` (kept, skipped if the chosen
  shape is not adopted) and a short report in `NOTES.md` for the Architect, who writes ADR 0048
  and the ADR 0033 s7 amendment from it.

  **Changed:** Spike report recommending shape (a). The server marks the element enclosing `{children}` with `data-children="<owner-tag>"`. The owner adds a region re-include: a second `@scope` block in native emission, a guard clause in lowered. The child adds the pseudo-boundary `[data-children]:not([data-children="T"])`. Shapes (b) and (c) were measured and rejected. Report: `spike/children-scope/FINDING.md`, summarized in NOTES.md.
  **How:** `server/tests/compiler/children-scope.ts` is a prototype that post-processes `emitScopedSheet` output; its fixtures are in `children-scope.test.ts`. The browser matrix covers both emissions and all three shapes, including self-nesting, in Chromium and WebKit (`spike/children-scope/*.probe.ts`). `measure.ts` measures byte cost over the corpus. No production code changed.
  **Check:** `bun spike/children-scope/generate.ts && node node_modules/.bin/playwright test --config spike/children-scope/playwright.config.ts` reproduces `results-*.json`. Gates: typecheck green. test:server green: 3389 pass after `build:docs`; the serve tests need a built `docs/`. Doubts for the Architect:
  - The native self-nesting difference (region rules resolve against any enclosing T).
  - Forwarded `{children}` and declared-role styling were reasoned through but not probed.
  - The marker name is unratified.
  **Review:** Approved: a spike with no production change, ruled into ADR 0048. The finding's lowered self-nesting "unstyled" row is the spike-time state; ADR 0048 s6 replaces it with the re-include (LT-473). The prototype and its test are deleted when LT-473 ports them.

- [x] LT-466: module-todo — move the in-place editor out of the checkbox label. — reviewed ✓
  **Area:** examples
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06; owner-confirmed bug):** each todo item places a `FormInplaceEdit`
  inside the `<label>` of its `form-checkbox`. Interactive content inside a label is invalid
  (HTML content model) and leaks activation: the edit button stops its click, but the
  double-click that starts editing bubbles to the label and toggles the checkbox. Move the
  `FormInplaceEdit` to beside the `form-checkbox` within the item, in both `module-todo.tsx` and
  `.tsrx` (CSS byte-identical, ADR 0039). The checkbox keeps an accessible name: a
  `.visually-hidden` label text bound to the item label (`{() => item.label.get()}`), so the
  visible text is the editor's and the name follows edits. Adjust the item grid in the sheet.
  **Verification:** a Playwright leg — double-clicking the label text enters edit mode without
  toggling the checkbox; the checkbox's accessible name tracks a committed edit; check:corpus,
  test:variants, `module-todo.spec.ts`.

  **Changed:** module-todo no longer nests the composed `FormInplaceEdit` inside the `form-checkbox`'s `<label>` (invalid HTML content model; the dblclick that starts editing bubbled to the label and toggled the checkbox). The editor now sits beside the checkbox within the item, in `module-todo.tsx` and `.tsrx` (CSS byte-identical, asserted by the corpus compile); the served `module-todo.html` template, the hand-written `.ts` twin, and the folder sheet were moved with it. The checkbox keeps its accessible name: the label keeps a `.visually-hidden` text bound to the item label (`{() => item.label.get()}` in the compiled members, `watch(item.label, bindText(...))` in the `.ts` twin's `bindItem`), so the name follows a committed edit. The item flex was adjusted in the sheet: the checkbox's own `flex-grow` is zeroed, the editor takes the free space, and a completed item keeps the text dim/line-through its label used to carry. Spec: the 19 toggling clicks on `form-checkbox .text` (the editor's span inside the label) became `form-checkbox label` clicks, and a new "Editor placement (LT-466)" describe adds the verification leg.

  **How:** One judgment call against the entry's wording: the label itself stays visible and only its text span carries `.visually-hidden`, because the visible checkbox box is drawn by that label's `::before` (form-checkbox.css) — hiding the whole label would hide the box. The completed-state dim/line-through rule was added to module-todo's sheet because the editor left the scope of form-checkbox's own `&.todo:has(input:checked) label` rule (the box still dims via that rule); it targets the `form-inplace-edit` host (in scope) so no `:global` is needed — drop that one rule if the owner prefers the entry's literal scope. `module-todo.html` was hand-mirrored to the compiled render (attribute-order differences vs. raw render predate this change; the `<template data-list>` region was verified equal after whitespace-stripping). Compiler snapshots for module-todo (sim-driver, parity) were regenerated; no other snapshot changed.

  **Check:** `bun run check:corpus` ✅ · `bun run typecheck` ✅ · `bun test server/tests` ✅ (3389 pass, 0 fail, after `build:docs` for the fresh worktree) · `bun run test:variants module-todo` ✅ (all 56 legs × ts/tsrx/tsx, including the two new LT-466 legs: dblclick enters edit without toggling; `toHaveAccessibleName` tracks a committed edit). Biome check on the changed paths clean. Review may want to confirm visually that the completed-item strikethrough renders (text-decoration on the `form-inplace-edit` flex host propagating to its `.text` item) — the spec does not assert it.

  **Review:** Approved. Both judgment calls stand as rulings: the label stays visible with only its text span `.visually-hidden` (the label's `::before` draws the box), and the completed-item dim/line-through moves to module-todo's own sheet on the `form-inplace-edit` host.

- [x] LT-467: Retire basic-pluralize — module-todo words its own count through an ICU message. — reviewed ✓
  **Area:** examples
  **Needs:** LT-466
  **Gates:** check:corpus, test:variants, test:server
  **Area:** examples
  **Filed (Architect, 2026-10-06; owner ruling 2026-10-06):** a parent words a count with its own
  ICU `plural` message, folded when server-known and re-evaluated by the inlined client evaluator
  when reactive (ADR 0030 s9). That left `basic-pluralize` no job, so it is retired.

  **Changed:** `basic-pluralize` is removed: its folder, its `main.ts`/`main.css` entries, the
  examples nav, the CEM comment, the `host-profile.d.ts` attrs, and the size-bet rows, including
  the React spike's twin. module-todo (`.tsx`/`.tsrx`) declares `remaining: '{count, plural, =0
  {…} one {# task remaining} other {# tasks remaining}}'` and renders `<p class="remaining">{() =>
  t.remaining({ count: activeCount.get() })}</p>`. The `.ts` twin binds the same source-locale text
  with `Intl.PluralRules('en')` in a `watch`. In every locale, `basic-pluralize.*` became
  `module-todo.remaining` (census 0 gaps). Compiler coverage moved to the `c-plural` fixture
  (`server/tests/compiler/fixtures/plural/`): gate-wave LT-143/LT-144/LT-173, the mf2-exit
  nested-pattern legs, the diagnostics, i18n-client and root-harvest legs, and the LT-191
  lang-materialization legs. i18n.test, smoke/corpus-args, parity and the page-render LT-191 leg
  pin module-todo. Snapshots regenerated: equivalence-audit, sim-driver, parity.
  `module-todo.spec.ts` adds an `en` leg (0, 1, 5) and a `pl` leg (0, 1, 2–4, 5) over a real
  `pl` server render. **Rework:** `examples/main.ts` imported module-todo's hand-written twin, not
  its generated client (LT-111 never switched it). The twin held the tag on every page and in
  every `test:variants` surface bundle, so the compiled spellings had never run in a browser.
  `main.ts` now imports `server/generated/components/module-todo.client.ts`.
  `server/tests/layout-graph.test.ts` pins the switch and lists the three remaining twin
  imports in `KNOWN_TWIN_IMPORTS` → LT-485.

  **Rulings (review):** declaring `i18n` makes every template literal an LTC047 warning, so
  module-todo's six labels became keys. The ar/cy/lv labels stay empty as source-fallback
  placeholders. LT-191's materialization is pinned by the `c-plural` simulation legs and the
  per-locale page leg; `basic-number` walks the locale but does not materialize it, so it
  cannot carry the leg.

  **Handoffs:** LT-485 (the three remaining twin imports), LT-486 (`writer`: the prose
  references), LT-487 (translator pass for the ar/cy/lv strings). LT-352's table lost its
  basic-pluralize rows (edited in place). CHANGELOG records the removal at iteration close.

  **Review:** Approved after one rework. The reviewer ran `test:variants module-todo` outside
  the sandbox: ts 58 pass (`pl` skipped by design), tsrx 60, tsx 60.

- [x] LT-469: Migrate `section-menu` to `.tsx` with same-commit cutover — the site's sidebar chrome: external toggle by document id, imperative backdrop, layout-wide registration. — reviewed ✓
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-427, LT-428, LT-429
  **Area:** examples
  **Scope (LT-446 design session, 2026-10-06):** the last uncompiled example folder. It carries
  four shapes no compiled member had carried together: an external toggle wired by document
  id, an imperative backdrop, a writable State-backed expose, and layout-wide registration.
  **Rulings (LT-446, applied verbatim):** `const open = createState(false)` + `expose({ open })`.
  `.js`/`.ready` are bare client-only setup statements. The five name constants live in setup.
  The backdrop is imperative, `on(ensureBackdrop(), …)`, and never authored in the template.
  The external toggle is looked up inline as the `on()`/`bindAria()` argument (both accept
  nullish targets); a setup const holding it would be LTC054, and `watch`/`on` in a function
  const would be LTC045. Document-level listeners ride `watch(() => true, descriptor)`.

  **Changed:** `section-menu` is a three-member variant set: `section-menu.tsx` (served), the
  `section-menu.tsrx` twin, and the hand-written `.ts` twin (LT-111 ruling 5). The template is
  the host passthrough plus one `<style>`. The compiled server render of the page-authored
  children is byte-identical to `server/templates/menu.ts`'s output (unchanged, still pinned by
  `templates/menu.test.ts`). The sheet is in ADR 0033 form: the page-shell rules sit in the
  whole-rule `:global` forms, and the drawer states are spelled `:host(.js)`/`:host(.js.ready)`/
  `:host(.js.open)`. Rider: `HTMLAnchorElement` joins `JS_GLOBALS` (`server/compiler/vocabulary.ts`,
  pinned in `globals.test.ts`); it removes a false LTC005 and adds no check. Cutover:
  `examples/main.ts` imports the canonical generated client, and `examples/main.css` imports the
  emitted sheet. The hand-written `section-menu.css` stays, unimported. `section-menu.html`
  carries the regeneration header. `examples/tsconfig.json` lists the twin pair, and the host
  profile gains `SectionMenuAttrs`. The tier census pins `section-menu: folded`, with zero
  routing signals. SERVER.md's sidebar bullet points at the emitted sheet. New snapshots:
  equivalence audit (the designed `.js` class and backdrop insertion at connect), sim-driver,
  and parity. `emit-tier.test.ts`'s dropped-statement scan strips the emitted
  `export type X = {…}` props alias, so the type member `open` no longer reads as a use of the
  dropped `open` const.

  **Review:** Approved. Accepted: the `emit-tier` strip (test-only, and value-position coverage
  is unchanged); the zero-specificity `:host` cascade, which now rides source order and was
  verified order-equivalent by the contributor; and the hoisted `:global` rules keeping
  authored nesting. Integration: the branch predated LT-093 and LT-464, and both sides had
  appended to `equivalence-audit.test.ts.snap` and `parity.test.ts.snap`. The reviewer merged
  `v3` into the branch, took `v3`'s snapshots, and let the suite write the section-menu entries
  back; they are byte-identical to the branch's. Gates on the merged state, all green:
  typecheck, `check:corpus` (42 entries: 35 folded, 7 simulated), `test:server` (3510/0),
  `test:variants section-menu` (20 × 3 surfaces), and the full example Playwright suite (996
  passed, 10 skipped), run outside the sandbox. The layout-wide registration made the full
  suite worth running.

- [x] LT-470: A composed child carrying `truc:pass` in a server-rendered branch of a list item mints a required local and throws in every item mount when the branch is not taken — refuse it after LT-468's manner. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-468
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-468's review):** in `planReconcileItem`'s item walk, a
  compose node in a server conditional's arm reached `collectCompose` with no branch awareness:
  it minted a required scope local, so with the branch folded off every adopted and cloned item
  threw `MissingElementError` at mount and the child's `truc:pass` entries never bound.
  **Ruling (Architect):** refuse, after LT-468's manner: the LTC005 family, the remedy "make
  the condition reactive". The LT-455 guard shape (optional local, guarded binding) was
  rejected, because a compose's pass entries have no reactive core of their own, so guarding
  them would mint per-entry existence guards for one-shot addressing. A pass-less compose in a
  branch stays legal.

  **Changed:** A `truc:pass`-carrying composed child in a server-rendered branch is refused
  (`LTC005`) in both scopes. In a reactive-list item, the item walk threads `inBranch` into
  `collectCompose` and refuses before minting. At the host, the probe found that the shape
  compiled clean on both surfaces with the entries silently unplanned: the branch handlers never
  visit a compose node. `validateArmSetPlacement` now refuses it there. It keys on an
  `inServerBranch` flag that a server `conditional` sets and that an arm set, a reactive list or
  composed content clears, and it skips arms (`unmountableInArm` refuses there) and lists (the
  item walk refuses there). A pass compose nested in composed content reports LTC011 alone,
  with no second LTC005. A pass-less composed child in a branch still compiles and renders into
  the template. A compose with `truc:pass` directly in the item still binds. The catalog face is
  in the LTC005 row of `skills/le-truc/references/errors.md`. The compose case sits beside
  LT-468's in HOST_PROFILE.md's item/Mount-Scope passage, AGENTS.md's conditional-placement
  paragraph and LE_TRUC_COMPILER.md's plan-walk passage. CHANGELOG has a Fixed entry. Tests:
  "a `truc:pass` compose in a server branch is refused (LT-470)" in
  `server/tests/compiler/mount-scopes.test.ts`.

  **Handoffs:** LT-481 plans pass entries on a compose arm root of a reactive conditional or an
  async boundary. Until it lands, that shape (this refusal's remedy) compiles clean and never
  binds. LT-482 treats a server-only `@try`'s body and catch arm as server-rendered branches in
  both walks.

  **Review:** Approved after two reworks: the host refusal now keys on the nearest enclosure,
  so composed content reports only LTC011.

- [x] LT-471: Design session — D-32, the compiler's public contract (entry points, result types, the generated-module API under semver). — done ✓
  **Area:** design
  **Area:** design (Architect with the owner)
  **Filed (Architect, planning 2026-10-06; owner scheduled it this iteration):** D-32 is deferred
  to a design session (`COMPILER_SPEC.md` §12, decision log). It gates LT-254, the first task of
  the P1 release track, and LT-376. Running it during the P6 round keeps the publish off the
  owner's calendar when P1 opens.
  **Questions to rule:**
  1. **Entry points** — one public entry point (dialect + one entry + consumer half, PROPOSAL D4)
     versus also publishing the corpus pass and the incremental API (§2).
  2. **Result types** — which types the entry points return are public. `RegistryEntry` names
     `RenderedShape` and `SuppressedSite`, and neither is exported: export them, or narrow
     `RegistryEntry`.
  3. **The generated-module API under semver** — ADR 0034 s8 counts it as public (a change is a
     major), while `contract.ts` and `LE_TRUC_COMPILER.md` §2 say semver applies to the designated
     set "and to nothing else", which does not list it. Rule which way it goes: add it to the
     policy, or amend the ADR (LT-254's rider).
  4. **Weigh `@typescript-eslint/typescript-estree` as a runtime dependency** under M28 if its
     answer turns on the entry-point shape (LT-254's rider). Otherwise it stays with LT-254.
  **Output:** the ruling recorded in `COMPILER_SPEC.md` §12 and its decision log (D-32 → Ratified),
  an in-place ADR 0034 s8 amendment if question 3 goes that way, and Appendix B refreshed (stale
  since 2026-09-29). Then re-scope LT-254 and LT-376 against the ruling.
  **Channel/tier:** none — design.
  **Ruled (owner, 2026-10-06) — done ✅.** (1) **Corpus entry point**, B. The one published
  entry point is the corpus pass. It writes to `outDir` and returns the diagnostics and a
  summary. `compileComponentTsx` stays internal, and the incremental API is a later minor.
  (2) **`RegistryEntry` narrowed** to a public projection. `RenderedShape` and `SuppressedSite`
  stay internal, and the projection is the `registry.json` schema. (3) **Generated-module API
  under semver**, added to the policy, so ADR 0034 s8 stands with no amendment. It covers
  `render<Name>`, the client default export, the `i18n` module's shape and the `registry.json`
  schema. `argsFromAttrs` is internal. (4) **`typescript-estree` stays with LT-254**, because
  its answer does not depend on the entry-point shape. Recorded in `COMPILER_SPEC.md` §2, §12,
  O-1, the decision log (D-32 → Ratified) and Appendix B (refreshed). The reshape is filed as
  LT-480 (P1, gates LT-254). LT-254 and LT-376 are re-scoped.

- [x] LT-472: Children Region — the server's region marker and the verifier's re-include (ADR 0048 s1). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-461, LT-465
  **Gates:** check:corpus, build:docs, check:links
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s1):** a parent owns the content it
  passes as `children`. Today the structural verifier excludes everything under a composed child
  (`:not(<child-tag> *)`), so a parent's `first()` into its own children fails LTC026.
  **Do:**
  1. **The region marker.** When the server renders a compiled compose site that passes children,
     and the child's template has a `{children}` insertion, write `data-children="<parent-tag>"`
     on the child's element that encloses the insertion. That element may be the child's root.
     The marker names the content's **owner**. When a child passes its own `children` straight
     through (`<D>{children}</D>`), the original owner's tag is written, not the forwarder's.
     Content that a forwarder wraps first (`<D><div>{children}</div></D>`) nests: D's region is
     owned by the forwarder, and the `div`'s region is owned by the original owner.
     An instance with no compiled owner (page-rendered) gets no marker. Extracted arm and list
     templates are server-rendered, so their clones carry the marker; pin that with a fixture.
  2. **The verifier.** Count the Children Region as the parent's markup when proving uniqueness,
     and exclude only the child's own template. The emitted runtime exclusion becomes
     `:not(:is(<child> *):not(:is([data-children="<tag>"] *):not(:is([data-children="<tag>"] <child> *))))`.
     That is the same algebra as LT-473's lowered guard, so write one helper that both use.
     Constructs in the children content emit into the enclosing Mount Scope's mount (ADR 0046 s1,
     as amended).
  3. **Docs.** HOST_PROFILE § data account bullet 3 (ownership) and § element references (the
     exclusion). Add `data-children` to VOCABULARY_LEDGER beside `data-key`, `data-arms` and
     `data-list`.
  **Channel/tier:** no new diagnostic. LTC026 stops firing for a parent reference into its own
  region. That changes LTC026's reach, so the handoff is `pending-review`.
  **Check:** a fixture composes a child whose template is `<pre><code>{children}</code></pre>`,
  on both surfaces, with a parent `first('code.x')`-style reference into the passed content. Also
  pin a forwarding fixture, an arm-held compose site and a list-item compose site.

  **Changed:** ADR 0048 s1's Children Region. At a compiled compose site whose child inserts `{children}`, the server writes `data-children="<owner-tag>"` on the child's element enclosing the insertion (the root included). The owner rides as a new optional second render parameter (`render<X>(args, __owner?)`): a compose site passes its own tag, a bare forward (`<D>{children}</D>`) passes its own owner on, a wrapped forward nests, and a page render passes none, so no marker. The verifier now matches, plans and counts a parent's `first()` into its compose-site content. The runtime query is `base:not(:is(<child> *):not(:is([data-children="<tag>"] *):not(:is([data-children="<tag>"] <child> *))))`, built by `excludeUnlessOwned` in the new `server/compiler/children-region.ts`. LT-473's lowered guard reuses that helper. LTC026 no longer fires for a reference into the parent's own region. Registry: new `childrenRegion` entry field (what a child renders in its region besides the content, plus forwards and unmarked). A `{children}` site's `renderedShapes` entry is now `{kind:'children'}` instead of `any`; it is still treated as unknown markup outside the region closure. Docs: HOST_PROFILE (data account bullet 3, element references), LE_TRUC_COMPILER selector section, VOCABULARY_LEDGER §7 (server-written markers).
  **How:** The front end's `collectMatchingElements` enters compose content. Analysis plans content refs (`planContentRefs`, which stops at nested compose sites; those stay LTC011). A region element's candidates count over a region probe that serializes compose content in place. A candidate is dropped when the child's own markup inside the region could match it, or when the element's compose child marks no region. The child's own markup in the region is `ComposedMarkup.region`, closed over grandchildren and forwards. Elements outside any region keep the old plain `:not(<child> *)` form and count, so no existing selector changed: check:corpus is green and the only corpus emission change is server-side markers.
  **Check:** `server/tests/compiler/children-region.test.ts` covers all of these:
  - `<pre><code>{children}</code></pre>` with `first('span.x')`, on both surfaces.
  - A page render with no marker.
  - The region-resident-markup drop (LTC007) and its outside-region counterpart.
  - Bare and wrapped forwarding, run against jsdom `querySelectorAll`.
  - An arm-held compose site (live arm + template) and a list-item template.

  test:server is 3500 pass / 16 fail. The 16 are exactly the failures LT-495 already fixed on v3, and the same set fails on my base `5f3fa952`. I wasn't allowed to fast-forward the branch to v3. Integration notes:
  1. LT-495 regenerated the module-dialog sim-driver snapshot on v3. After merge it also needs the new `data-children="module-dialog"` on `div.content`. I did not touch that line.
  2. I spliced in only the module-lazyload (sim + equivalence) and module-listnav (sim) entries.
  3. module-listnav's fixed point depends on test order: it fails run alone on base too. It passes once lazyload's test runs fully.

  typecheck, check:contract, check:corpus, build:docs, check:links (776/776) and lint:server are all green.

  Doubts:
  - **Mixed-content forward** (`<E><b/>{children}</E>`): the content is unmarked, so a parent reference into it fails LTC007 with a generic message. A dedicated diagnostic needs a ruling.
  - **List-item-setup `first()`** into item compose content now verifies. It emits the authored selector verbatim, which is the existing item-ref policy: no composed-child exclusion.
  - A child that declares `children` but never inserts them leaves the parent's ref unaddressable (LTC007), not a sharper error.

  **Review:** Approved. The marker and the owner channel match ADR 0048 s1. The owner rides as an optional second render parameter. That is additive to the generated-module API (ruling 11), and `check:contract` is green. A page-rendered or page-forwarded instance passes `undefined`, which `attr()` omits, so no marker appears. `excludeUnlessOwned` is the single helper that LT-473 reuses. Elements outside any region keep the old exclusion, so no existing selector moved. The only corpus change is the server-written markers (module-dialog's scrollarea `<div>`, module-lazyload's callouts, live and in their templates). **Reviewer merge:** the branch was based on `5f3fa952`, before LT-495. I merged v3 (`a6252ff9`) and resolved the equivalence-audit conflict by regenerating on the merged state. The diff against v3 is three entries, markers only. Re-run on the merged state: `test:server` 3543/0, `typecheck`, `check:contract`, `check:corpus`, `build:docs`, `check:links` 776/776. Outside the sandbox: `test:component` module-dialog 43/43, module-lazyload 40/40 and module-listnav 14/14 (the order-dependent fixed point the contributor noted passes in the full suite). **Doubts:** (1) mixed-content forward and (3) declared-but-never-inserted children both stay refused, because s1 gives them no region; the message should name the cause, filed as LT-497 (P7). (2) A list-item-setup `first()` emitting the authored selector verbatim is accepted. It follows ADR 0046's item-ref policy, item-root scoped with no composed-child exclusion, and a selector that could match the child's own markup is still dropped by the region-resident check.

- [x] LT-481: A `truc:pass` on a compose site that is a reactive arm root compiles clean and never binds — plan the entries in the arm's mount. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-470
  **Gates:** check:corpus, test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-470's probe finding 3):** LT-460 made a compose site
  legal as an arm root, but its `truc:pass` entries were never planned. The arm walk checked
  only the root's descendants against `unmountableInArm`, so the shape compiled to an empty
  `bindArm` on both surfaces. That is the silent drop LT-470's remedy steered authors into.

  **Changed:** A compose site as an arm root now plans its `truc:pass` entries as `pass()`
  effects in the arm's mount, against the arm element parameter. The arm root is the child's
  rendered element, so no query or local is minted. The entries rebind on every adopt and clone.
  This covers reactive `@if`/`@switch` arms (host and nested Mount Scopes) and the async
  boundary's pending and catch arms, on both surfaces. The lowering is `planArmRootComposePass`
  in `server/compiler/analysis/effects.ts`. It shares `checkPassEntries` + `emitPassEntries` with
  every other compose path, and `composeArmRootTag` dedupes LT-460's tag expression.
  `emit-client.ts`'s `emitBoundary` gained the `nil` mount branch and the err arm's root local
  and effects. A `first()` on a compose arm root is now refused (LTC005); it was never refused
  before, and the fix names `truc:pass` as the channel. An ambiguous `first()` keeps LTC027 as
  its one diagnostic. `reconcile()`'s arm path already inserted a clone before mounting it, so
  no runtime change was needed. Docs: HOST_PROFILE.md's arm-root paragraph, LE_TRUC_COMPILER.md's
  ClientPlan passage, and a CHANGELOG Fixed entry. LT-470's remedy sentences now hold as written.
  Tests: "compose arm roots plan their `truc:pass` entries (LT-481)" in
  `server/tests/compiler/compose.test.ts`.

  **Handoffs:** the compose root of a server-only `@try` arm → LT-482 shape (e). The boundary's
  name check (`badFreeNames` vs `fx.scopeBadNames`) → LT-483. Element pending/catch roots refusing
  constructs that reactive-conditional arm roots plan → LT-484 (design).

  **Review:** Approved. The review probed list-item nesting: a reactive arm root and a pending
  root passing `() => item.get()` both bind.

- [x] LT-482: A server-only `@try` is a server-rendered branch the plan walks don't treat as one — a `truc:pass` compose in its body compiles clean and never binds. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-470
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-470's rework residue; widened by LT-481's residue 1):**
  a `try` with no `pending` arm is not an arm set. It folds once per render into its body or its
  catch arm, but the walks treated only server `conditional`s as server-rendered branches.
  **Ruling (Architect):** a server-only `try`'s body and catch arm are server-rendered branches,
  so LT-468's and LT-470's refusals apply unchanged.

  **Probe (both surfaces agree on every shape):** (a) a pass compose in a server-only `try` at
  the host compiled clean and never bound: fixed. (b) and (c), a pass compose or a client
  construct in a server-only `try` inside a reactive-list item: already refused, because
  `validateListBody` (`lower-shared.ts`) refuses any boundary in a reactive-list body, so no
  `try` reaches the item walk and the entry's item-walk descent would be dead code (not added).
  (d) a client construct in a server-only `try` at the host: already plans the guarded binding
  through `handleOptionalBranch`. (e) a compose as the body or catch-arm root carrying
  `truc:pass`: compiled clean and never bound, fixed by the same change. Also already refused:
  a pass compose in a server-only `try` nested in a reactive arm (`unmountableInArm`), and a
  reactive list in a server-only `try` body.

  **Changed:** `validateArmSetPlacement` sets `inServerBranch` for a `try` that is not an arm
  set, so (a) and (e) fail the compile with LT-470's message (LTC005). A pass-less compose in a
  `try` stays legal and renders. The refusal fires once per offending compose site.
  LE_TRUC_COMPILER.md's LT-470 sentence names the server-only `try`'s arms. CHANGELOG Fixed
  entry. Tests in `server/tests/compiler/mount-scopes.test.ts`.

  **Handoffs:** LT-488 rewords the remedy for a `try` site. "Make the condition reactive" names
  a condition a `try` does not have.

  **Review:** Approved. The ruling's "same wording and remedy" was the Architect's error for a
  `try` and is not held against the task; LT-488 corrects it.

- [x] LT-485: The examples layout graph registers module-calctable, module-cem-list and module-ticker through their `.ts` twins — switch them to the compiled clients. — reviewed ✓
  **Area:** examples
  **Needs:** LT-467
  **Gates:** test:variants, test:server, check:corpus
  **Area:** examples
  **Needs:** LT-467
  **Filed (Architect, 2026-10-07, from LT-467's rework and its NOTES entry):** `examples/main.ts`
  imports `./module/calctable/module-calctable.ts`, `./module/cem-list/module-cem-list.ts` and
  `./module/ticker/module-ticker.ts`, the hand-written twins, instead of
  `server/generated/components/<tag>.client.ts`. The graph is the default page bundle and the
  base of every `test:variants` surface bundle. `buildSurfaceBundle` (`server/routes.ts`) empties
  only the generated-client slot, so the twin holds the tag on every surface: the `tsx` bundle
  carries no compiled client, and the `tsrx` module's `define` throws. A green `test:variants`
  for these three sets has measured the twin three times. That breaks the iteration's exit
  criterion ("every example folder is served compiled") and leaves the compiled spellings
  untested in a browser before LT-463 converts them.
  **Change:** for each of the three, replace the twin import with the generated client import,
  in the same position and with the same comment style as LT-467's module-todo switch. Remove
  the tag from `KNOWN_TWIN_IMPORTS` in `server/tests/layout-graph.test.ts`. When the set is
  empty, the first test asserts `[]`; keep it as the standing guard.
  **Expect failures:** the compiled clients have never run in a browser. Triage each failing
  leg by cause:
  - a spec that asserted twin-only behavior is adjusted, with the reason stated;
  - a compiled-client defect the corpus compile did not catch is NOT fixed in this task. File
    it in `NOTES.md` with the leg, the surface and a minimal reproduction, and leave that one
    tag on its twin (back in `KNOWN_TWIN_IMPORTS`, with a comment naming the note). The other
    switches still land.
  **Check:** `bun run test:variants module-calctable module-cem-list module-ticker` (or one at
  a time) is green on every surface for each switched tag. Run it outside the sandbox if
  Playwright cannot launch; otherwise state it as unrun for the owner. `test:server`
  (layout-graph) and `check:corpus` are also green.
  **Channel/tier:** none — serving-path and test fix, no runtime check.

  **Changed:** `examples/main.ts` registers module-calctable, module-cem-list and module-ticker through their generated clients (`server/generated/components/<tag>.client.ts`) instead of the hand-written `.ts` twins; `KNOWN_TWIN_IMPORTS` in `server/tests/layout-graph.test.ts` is now empty and its first test (`imports no variant-set twin`) is the standing inverted guard.

  **How:** The same switch LT-467 made for module-todo, one comment block in its style per import (the full twin-holds-the-tag explanation once, at module-calctable; cem-list and ticker point at it). The twins stay on disk — `test:variants`' `ts` legs still serve them through `buildSurfaceBundle`'s slot swap, so no surface loses coverage and nothing is deleted.

  **Check:** `test:server` 3510 pass / 0 fail; `check:corpus` exit 0; `bun run test:variants module-ticker` green on all three surfaces (Chromium + WebKit, 24 legs) — the compiled ticker client's first browser run passed with no triage, so nothing went back on a twin and nothing was filed in NOTES.md. `typecheck` exit 0 (insurance, not a named gate). NOT runnable: `bun run test:variants module-calctable` and `module-cem-list` — neither folder carries a `.spec.ts`, so the runner refuses with "No variant set matches" (exit 1); the entry's Check line assumed otherwise. Their compiled clients still execute on every `/test/*` page load (main.ts is every surface bundle's base) — registration smoke passed in both browsers on all ticker legs; full behavior coverage awaits specs, a pre-existing gap left unfiled.

  **Review:** Approved. Accepted: the not-runnable deviation for module-calctable and module-cem-list — the entry's Check line wrongly assumed specs, but the refusal is real, the graph-bundle registration smoke is a fair substitute, and spec-less module folders are the corpus norm (5 of 19); no follow-up filed. Accepted: `module-ticker.client.ts` placed in the generated block's sorted position rather than at the twin's old out-of-order spot at the end. Reviewer re-ran the gates on the branch tip in the worktree: `check:corpus` exit 0, `test:server` 3510 pass / 0 fail, `test:variants module-ticker` green on all three surfaces, both refusals reproduced, biome clean on the two touched files. The branch tip sat on v3's HEAD; the integrate is a fast-forward.

- [x] LT-486: Prose still cites the retired basic-pluralize — repoint each reference (writer). — reviewed ✓
  **Area:** docs
  **Needs:** LT-467
  **Gates:** build:docs, check:links
  **Area:** docs
  **Needs:** LT-467
  **Filed (Architect, 2026-10-07, from LT-467's handoff):** LT-467 retired `basic-pluralize`.
  Its coverage moved to the `c-plural` test fixture (`server/tests/compiler/fixtures/plural/`),
  and module-todo now words its count through its own ICU message. These prose references still
  cite the example as live:
  - `AGENTS.md`: the built-in IDL property paragraph ("`basic-pluralize` materializes its
    walked locale onto the `lang` attribute at connect; LT-191"). The behavior is still
    compiled (`c-plural` pins it), but no served example shows it now.
  - `server/compiler/HOST_PROFILE.md` :158 (locale precedence) and :178 (source strings and
    catalogs).
  - `server/compiler/LE_TRUC_COMPILER.md` :770.
  - `server/TESTS.md` :184 and :192.
  - `i18n/README.md` :9 and :18 (example keys).
  - `spike/size-bet/FINDING.md` :31.
  - `examples/main.ts` :53 (comment).
  **Do:** repoint each to module-todo's `remaining` message where it illustrates a parent's own
  ICU plural. Point it at the `c-plural` fixture where it illustrates compiler coverage (walked
  locale, nested `select`/`selectordinal`). Delete it where the example was incidental. ADR text
  stays as history. CHANGELOG records the removal at iteration close (Architect hands it to
  `writer` with the iteration).
  **Check:** `git grep basic-pluralize -- ':!adr' ':!CHANGELOG.md' ':!queue' ':!server/tests'`
  returns only lines that name the retirement deliberately. `build:docs` and `check:links` are
  green.

  **Changed:** repointed the live `basic-pluralize` citations — `AGENTS.md`, `LE_TRUC_COMPILER.md` to the `c-plural` fixture; `HOST_PROFILE.md` and `i18n/README.md` keys to `module-todo.remaining`; locale-precedence names `basic-number` alone; `TESTS.md` and the size-bet `FINDING.md` (a run of record) mark the retirement in place.
  **Review:** Approved (2026-10-07). The check holds: the remaining `basic-pluralize` mentions outside adr/queue/CHANGELOG/tests all name the retirement deliberately.

- [x] LT-488: The LT-470 refusal tells a server-only `@try` site to "make the condition reactive" — a `try` has no condition; give it its own remedy. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-482
  **Gates:** test:server
  **Area:** compiler
  **Filed (Architect, 2026-10-07, from LT-482's review):** LT-470's refusal told a server-only
  `@try` site to "make the condition reactive", but a `try` has no condition.

  **Changed:** `validateArmSetPlacement`'s `inServerBranch` became a `ServerBranch` union
  (`false | 'conditional' | 'try-body' | 'try-catch'`), keyed per child by the arm that holds it.
  The nearest enclosure wins on nesting. `serverBranchFix` words the LTC005 fix per enclosure,
  under the same subject head:
  - server conditional: unchanged;
  - `try` body: move the composed child out of the `try`;
  - `try` catch arm: add a pending arm, which makes the `try` an async boundary whose catch arm
    binds the pass (LT-481).
  The LTC005 face in `skills/le-truc/references/errors.md` and LT-482's CHANGELOG line follow.
  LT-482's tests assert the per-arm fix on both surfaces.

  **Review:** Approved. The catch-arm mechanism clause the contributor added ("The catch arm
  folds once per render…") stays: it gives the message its three-part form.

- [x] LT-490: Setup extraction drops a const read only inside a handler-arg body — walk handler args as client dependencies. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-461
  **Gates:** test:server, check:corpus, test:variants
  **Area:** compiler
  **Needs:** LT-461
  **Filed (Architect, 2026-10-07, from LT-463's review):** a setup `const` read only by the body
  of a handler arg on a compose site (`<BasicButton onClick={() => … ALPHA …} />`, LT-461) is
  dropped from the generated client, and the generated module fails tsc with TS2304. The emitted
  `on(…)` lands inside the factory, where the const would be in scope, so this is a missed edge in
  the client-needed walk, not a design stance: setup extraction walks native `onX` attribute
  bodies but not handler-arg bodies. LT-463 worked around it by moving module-ticker's `ALPHA`
  into the add-rows handler (both members of the variant set).
  **Change:** the client-needed fixpoint (the walk LT-093 also extends) counts free names in a
  compose site's handler-arg bodies as client reads, exactly as it does for a native `onX`
  attribute. Pin it with a server-suite test: a setup const read only by a handler arg survives
  into the generated client and the generated module typechecks. Then restore module-ticker's
  `ALPHA` to a setup const in the `.tsx` and `.tsrx` members and drop the workaround comment.
  **Check:** `test:server` green with the new pin; `check:corpus` green; `bun run test:component
  module-ticker` green on all surfaces.
  **Channel/tier:** none — a miscompile fix; no new check.

  **Changed:** `computeClientNeededNames` (`server/compiler/imports.ts`, via `clientExprNodes`) now counts a non-forwarded compose-site handler arg's body as a client read, like a native `onX` attribute; module-ticker's `ALPHA` is a setup const again in the `.tsx` and `.tsrx` members, workaround comment dropped.
  **How:** the compose branch of `clientExprNodes` pushes `attr.handler` for `kind: 'handler'` with `forward === null` (a forwarded arg emits nothing). New pin in `server/tests/compiler/handler-args.test.ts`: a setup const read only by a handler arg survives into the generated client, and an in-memory tsc program over that module reports no TS2304 (red without the fix). A plain import read only by a handler arg now lands client-side too, by the same walk.
  **Check:** handler-args 18/18; typecheck, check:contract, check:corpus green; biome clean on touched paths; generated `module-ticker.client.ts` and the `.tsrx` variant client declare `ALPHA`. `test:server` is 3491 pass / 16 fail — the identical 16 fail at base 91dd207a (client golden, sim-driver, equivalence audit, variant parity snapshots for module-list/ticker/todo/dialog, and the variant-set typecheck; the golden registry lacks basic-button after LT-463's compose conversion). Not filed as far as I can see — needs a task; module-ticker's parity snapshot will also pick up this change when regenerated. Unrunnable in the sandbox (browser launch timeout): `test:component module-ticker`, `test:variants`.

  **Review:** Approved. The `clientExprNodes` edge matches the native `onX` treatment, and a forwarded arg correctly contributes nothing. The pin is red without the fix and checks real tsc diagnostics, not a string match. The widening to plain imports read only by a handler arg is the same walk and correct. Re-run in the worktree: handler-args 18/18, typecheck, check:corpus, and the generated ticker client declares `ALPHA`. `test:component module-ticker` passes 8/8 outside the sandbox. The contributor's question: the 16 `test:server` failures at base are LT-463's, not this branch's. LT-463's gates never named `test:server`, and its review didn't run it. They have three causes: a real TS2322 (JSX children against `children?: string`), the golden harness's compose registry lacking basic-button, and by-design snapshot drift. Filed as LT-495 (ruling 13), which also regenerates the ticker parity snapshot this branch moves.

- [x] LT-491: section-menu's "closes when a menu link is clicked" fails on Chromium and WebKit. — reviewed ✓
  **Area:** examples
  **Needs:** LT-469
  **Gates:** test:variants
  **Area:** examples
  **Needs:** LT-469
  **Filed (Architect, 2026-10-07, from LT-463's review):** `section-menu.spec.ts` › "closes when a
  menu link is clicked" fails on Chromium and WebKit on all three surfaces at v3 `e94928f6`
  (LT-463's base, proven by a clean-tree run). Firefox passes. After the link click the menu keeps
  its `open` class. LT-469 compiled section-menu and integrated green, so either a later
  integration regressed it or the failure is environment-sensitive. Find out which first:
  bisect from LT-469's merge.
  **Change:** fix the cause. If the regression is in the compiled client or the compiler, fix it
  there and pin it. If the spec races navigation (the link click navigates or scrolls before the
  assertion), make the spec assert the designed behavior deterministically. Do not weaken the
  assertion. Record which case it was on the entry.
  **Check:** `bun run test:variants section-menu` green on all browsers and surfaces.
  **Channel/tier:** none — a test or behavior fix; no new check.

  **Changed:** fixed the section-menu test fixture; nothing regressed. The test layout (`docs-src/layouts/test.html:6`) sets `<base href="/">`, so the fixture's `href="#page-one"` resolved to `/#page-one`. Clicking it left the page for `/`, which 404s (the failure trace shows a "Not Found" page and "element(s) not found"). Firefox passed only because its navigation committed after the class assertion had already passed. Nothing changed since LT-469's merge `11a31e4f` in section-menu, the runtime, scrollarea or the test server, and the hand-written `.ts` surface fails too.
  **How:** the fixture links now carry the page path (`/test/section-menu#page-…`), so the click stays a same-document fragment navigation. The spec now asserts `toHaveURL(/\/test\/section-menu#page-one$/)` before the unchanged `not.toHaveClass(/open/)`, so a navigation away fails with a clear message. The assertion is not weakened.
  **Check:** `bun run test:variants section-menu`, all browsers and surfaces. It was UNRUNNABLE in this session: browsers time out in `beforeEach` inside the sandbox, and running outside it was refused. `check:corpus` green and `biome check` clean on the two paths. Doubt: other fixtures that use bare `#fragment` links under the same `<base>` may race the same way.

  **Review:** Approved. The root cause holds: the test layout's `<base href="/">` (`docs-src/layouts/test.html:6`) resolves a bare `#page-one` to `/#page-one`, so the click navigated away. The fix belongs in the fixture rather than the layout, because `section-menu.html` is test-only (no `.md` docs page, and no server test reads it). The new `toHaveURL` assertion makes a navigation away fail loudly, and the original assertions stand. The contributor's doubt: the only other fixture with bare `#` links is form-listbox's, and its spec never clicks them, so no other spec is exposed. Re-run outside the sandbox: `test:variants section-menu` 20/20 on each of the ts, tsrx and tsx surfaces.

- [x] LT-495: Repair LT-463's `test:server` fallout — JSX children against a `string` children prop, the golden compose registry, and the composition snapshots. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-463, LT-490
  **Gates:** test:server, typecheck, check:corpus
  **Area:** compiler
  **Needs:** LT-463, LT-490
  **Filed (Architect, 2026-10-07, from LT-490's review):** `test:server` has failed 16 tests on v3
  since LT-463 integrated (`c090d4e7`). LT-463's gates did not name `test:server`, and the review
  did not run it. There are three causes, and each is ruled below.
  **1. A real type error: JSX children against a `string` `children` prop.**
  - The variant-set typecheck fails with TS2322 ("Type 'Element' is not assignable to type
    'string'") at module-dialog.tsx:138 and module-lazyload.tsx:122/129.
  - ModuleScrollarea and CardCallout declare `children?: string`, the server-side truth: the
    compiler lowers compose-site children to a markup string. But tsc checks the JSX children
    against that declared type.
  - **Ruling:** the host profile translates. In `host-profile.d.ts`, `LibraryManagedAttributes`
    maps a string-assignable `children` to the JSX-children type: `JSX.Element | string`, singly
    or as an array, which is what the compose lowering accepts. Do this beside the `i18n` omission
    and keep the discriminated-union distribution. This also covers LT-474's branded `Children<…>`
    string (ADR 0048 s2), because the brand stays string-assignable.
  - **Rejected:** retyping each child's `children` as `JSX.Element`. That would lie about the
    server arg and break the `children = ''` defaults.
  - Pin it in the `.tsx` typecheck fixtures: a compose site with element children against
    `children?: string` typechecks, and a function child still fails.
  **2. A golden-harness gap.** `client.golden` and `server.golden` build a compose registry from
  form-textbox alone. module-list now composes `<BasicButton>`, so it fails to compile there
  ("corpus components must compile"). Add basic-button to both harnesses' compile-first set.
  Don't stub it.
  **3. Snapshots.** Regenerate them: the sim-driver fixtures (module-list, ticker, todo, dialog),
  the equivalence audit (list, ticker, todo), the client golden (module-list) and the variant
  parity (list, ticker, todo). Read each diff before accepting it. It must show only
  the composition change from LT-463 (BasicButton's `secondary medium`/`constructive medium` inner
  classes, the empty badge span, the composed-root attributes) and, for the ticker, LT-490's
  `ALPHA`. Any other difference stops the task: write it in `NOTES.md`.
  **Check:** `test:server` 0 failures; `typecheck` and `check:corpus` green.
  **Channel/tier:** TypeScript — a host-profile typing fix that makes a correct compose site
  typecheck. No new check.

  **Changed:** the `.tsx` host profile's `JSX.LibraryManagedAttributes` now maps a string-assignable `children` arg to `ComposeChildren` (`JSX.Element | string`, singly or as an array), keeping the arg's optionality and the distributive `i18n` omission. The client and server golden harnesses compile basic-button into the compose registry, and the LT-463/LT-490 snapshots are regenerated.
  **How:** `host-profile.d.ts` adds `ComposeArgs<P>`, applied per union member inside the existing distribution. New fixtures: `string-children-compose.tsx` (positive: element, several, text, mixed, none, required) and `string-children-bad.tsx` (negative: a function child, a missing required `children`), asserted in `tsx/typecheck.test.ts`. client.golden builds its compose registry from a `COMPOSE_FIRST` list (form-textbox, basic-button). server.golden compiles, emits and i18n-collects basic-button. With the harness fixed, server.golden's hard-coded module-list expectation became reachable again; it now shows BasicButton's own render (`constructive medium`, label span, empty badge span). HOST_PROFILE.md notes the mapping next to the `i18n` omission.
  **Check:** `test:server` 3534 pass / 0 fail; `typecheck`, `check:corpus` and `check:contract` are green. I read every snapshot diff. Render markup shows only the composition (BasicButton's inner classes, the badge span, and ModuleScrollarea's own `<div>` wrapper in module-dialog) plus LT-490's reflowed ticker handler. Some entries were only reordered (section-menu, module-lazyload, form-checkbox). **One doubt for review:** the client modules' element references also changed, and the ruling did not list this. The live pipeline (`server/generated`) already emits the same: `first('basic-button.submit')` → `first('basic-button')` in module-list/module-todo, because a composed child is referenced by tag, like `first('form-textbox')`; in module-todo it relies on document order ahead of `.clear-completed`. Ticker's `button.toggle`/`button.add-rows` → `basic-button.toggle button`/`basic-button.add-rows button`, because the composed inner button no longer carries those classes. I judged these part of LT-463's composition change rather than stopping. Playwright was not run (no example source changed).

  **Review:** Approved. `ComposeArgs` maps only a string-assignable `children`: it keeps the arg's optionality, sits inside the existing distribution so discriminated args keep discriminating, and covers ADR 0048's branded `Children<…>`. The negative fixture pins both remaining errors (a function child, and a missing required `children`). The golden harnesses now compile basic-button first rather than stubbing it. The snapshot diffs are the composition change plus LT-490's ticker handler. module-dialog's extra `<div>` is ModuleScrollarea's own wrapper, which the live pipeline already renders. Re-run in the worktree: `test:server` 3534/0, `typecheck`, `check:corpus`. The contributor's doubt: the reference changes are right to accept, because the snapshots must mirror the live pipeline and `server/generated` already emits them. The concern behind the doubt is real but outside this task. The compose-site selector ignores raw same-tag elements, so module-todo's and module-list's `first('basic-button')` is correct only by document order. Filed as LT-496 (track K, after this task).

- [x] LT-496: A compose site's element reference ignores raw same-tag elements — count every element of the child's tag when choosing the selector. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-495
  **Gates:** test:server, check:corpus, typecheck
  **Area:** compiler
  **Needs:** LT-495
  **Filed (Architect, 2026-10-07, from LT-495's review):** in `analysis/effects.ts`, the
  compose-site reference adds a discriminator clause only when `countComposeBySource` finds more
  than one compose site of the same child. Raw elements of the same tag in the parent's template
  are not counted. module-todo composes one `<BasicButton class="submit">` beside raw
  `<basic-button class="remove">` (in list items) and `<basic-button class="clear-completed">`, so
  the generated client queries `first('basic-button')`. That is correct today only because the
  submit comes first in document order. Moving the form below the footer would silently bind the
  submit's `disabled` pass to the clear-completed button. module-list has the same shape.
  **Change:** the uniqueness count covers every element of the child's tag the parent's
  template can render, raw or composed. That includes elements in list items and arms, since a
  host-level `first()` matches them too. When the tag is not unique, use the site's
  discriminator clause (`composeDiscriminatorClause`, now considering all those elements). With
  no distinguishing static class/id/`data-*`, refuse through the existing
  `unaddressableElement` diagnostic with the same fix-it. Leave LT-319's shared-pass grouping
  unchanged; it still applies only to compose sites.
  **Check:** a `test:server` pin: a compose site beside a raw same-tag element emits the
  discriminated selector (`first('basic-button.submit')`), and an indistinguishable pair is
  refused. Regenerate module-list's and module-todo's client snapshots; the only change should be
  `basic-button` → `basic-button.submit`. `check:corpus` and `typecheck` green.
  **Channel/tier:** compiler, tier 1 Prevented. No new LTC: the refusal reuses the existing
  unaddressable-element diagnostic's code.

  **Changed:** A compose site's element reference now counts raw elements of the child's tag (list items, arms and compose-site content included, via the region probe) against its uniqueness. module-list and module-todo now query `first('basic-button.submit')`.
  **How:** `emitComposeEffects` (`analysis/effects.ts`) adds a `matchesRaw(clause)` predicate over the new `countRenderedForSelector` (`analysis/selectors.ts`, wrapping `probeCountWithRegions`). A raw match of the bare tag forces the discriminator search. `composeDiscriminatorClause` takes `matchesRaw` as an optional third argument (defaulting to "no raw match") and rejects a clause that also matches a raw element. Otherwise the site is refused as LTC007, and a raw-only clash gets its own copy: "Give the site a class no other <tag> carries." The LT-319 grouping is unchanged, with one guard added: a shared clause that also matches a raw element is refused instead of lowering to `all()`. HOST_PROFILE.md now states the rule. Regression pins are in `compose.test.ts` (raw before the site, raw in an arm, a shared class refused, an indistinguishable pair refused, no clash keeps the bare tag). The client golden and parity snapshots were regenerated, and the only change is `basic-button` → `basic-button.submit` (module-list .tsrx/.tsx, module-todo).
  **Check:** test:server 3548/0, typecheck, check:corpus, check:contract, build:docs and check:links are green. Doubts: (1) The other `composeDiscriminatorClause` callers have the same blind spot but were left alone as out of scope: the forwarded handler args in `handler-args.ts`, list-item compose passes, and `composeSiteSelector`. A follow-up may be worth filing. (2) The LT-319 raw guard goes slightly beyond "leave unchanged". (3) When several sites clash and a raw element is also involved, the "Multiple sites" copy is still the one shown. (4) The browser gate `bun run test:component module-todo` hung with no output for 5 minutes, so it is unrunnable here and the owner should run it for module-todo and module-list. `server/tests/compiler/update-snapshots.ts` is stale: it doesn't regenerate module-list. `UPDATE_SNAPSHOTS=1` on client.golden.test.ts does.

  **Review:** Approved. `matchesRaw` over the region probe counts raw same-tag elements in list items, arms and compose content. A clause that a raw element also matches is rejected, and the corpus moves exactly as the entry predicted (`basic-button` → `basic-button.submit` in module-list and module-todo, live pipeline and snapshots alike). The pins cover each shape. Re-run in the worktree: `test:server` 3548/0, `typecheck`, `check:corpus`. Outside the sandbox: `test:variants module-todo` passes on every surface (ts 58, tsrx 60, tsx 60; the ts count is the twin's own suite). module-list has no spec. **Doubts:** (1) the other discriminator callers, filed as LT-498 (track K) together with a second gap: elements of the tag inside another composed child's own template. (2) The LT-319 raw guard is accepted. It is required for correctness, because a shared `all()` would otherwise sweep in the raw element, and refusing is the ruled fallback. (3) The "Multiple sites" copy for a mixed clash is accepted; it still names the right fix (a distinct class). (4) The browser gate: the reviewer ran it, see above. The stale `update-snapshots.ts` rides LT-498.

- [x] LT-498: Close the remaining raw-same-tag blind spots in compose-site selectors — the other discriminator callers and composed children's own templates. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-496
  **Gates:** test:server, check:corpus, typecheck
  **Area:** compiler
  **Needs:** LT-496
  **Filed (Architect, 2026-10-07, from LT-496's review):** LT-496 made `emitComposeEffects`'s
  reference count raw elements of the child's tag. Two blind spots of the same class remain, and
  each can bind a query to the wrong element by document order:
  1. **The other `composeDiscriminatorClause` callers** still decide uniqueness among compose
     sites alone:
     - the forwarded handler arg's site selector (`analysis/handler-args.ts`, which uses `''`
       for a single sibling);
     - the reactive-list item's compose passes;
     - the arm-held compose site's `composeSiteSelector`;
     - `composeSharedPassClause`'s sibling check (`analysis/selectors.ts`).

     Route them all through the LT-496 predicate (`matchesRaw` over `countRenderedForSelector`),
     scoped the way each query is scoped: the host for host-level queries, the item root for
     item queries, the arm root for arm queries. Better, give the four one shared helper that
     returns the clause or the refusal, so a fifth caller cannot drift.
  2. **Elements inside a composed child's own template.** A host-level `first('<tag>.<clause>')`
     also matches an element of that tag that another composed child renders internally, e.g. a
     `basic-button` inside a composed child's template. The registry's `renderedShapes` closure
     (the one LT-472's region proof uses) already lists them. Count those shapes too, or exclude
     other composed children's subtrees from the query, the way raw `first()` refs do with
     `:not(<child> *)`. Prefer the exclusion. It is what LT-316 does for raw refs, and it doesn't
     refuse sites that are in fact unique in the served DOM.

  Tooling rider: `server/tests/compiler/update-snapshots.ts` no longer regenerates module-list's
  client snapshot (only `UPDATE_SNAPSHOTS=1` on `client.golden.test.ts` does). Fix it or delete it
  in favor of the env flag, and say which in the handoff.
  **Check:** `test:server` pins one case per caller in (1), plus (2)'s case: a child whose
  template renders the tag, composed beside a site of that tag. `check:corpus` green, and every
  corpus selector change listed in the handoff.
  **Channel/tier:** compiler, tier 1 Prevented. It reuses LTC007's raw-clash message from
  LT-496; no new code.

  **Changed:** every compose-site query chooses its clause through one helper,
  `composeSiteAddress` (`analysis/selectors.ts`). It covers `emitComposeEffects`, the host and
  arm handler sites, the reactive-list item's passes, the forwarded handler arg and LT-319's
  shared-pass check. A raw element of the child's tag counts against the site within the query's
  own scope. An element another composed child renders is excluded with `:not(<child> *)`,
  region-aware (`composedEmitter`, factored out of `selectorCandidates`). Refusals keep LTC007
  through `composeSiteRefusal`. `update-snapshots.ts` is deleted;
  `UPDATE_SNAPSHOTS=1 bun test server/tests/compiler/client.golden.test.ts` is the one path.
  Corpus selectors: module-todo `form-textbox:not(form-inplace-edit *)`, module-listnav
  `form-listbox:not(module-lazyload *)`.
  **Review:** Approved (2026-10-07). Gates re-run: typecheck, test:server 3561/0, check:corpus,
  and biome all green. The owner runs `test:component module-todo module-listnav`, which can't
  run in the sandbox. Rulings on the contributor's doubts:
  - (1) The forwarded handler arg's over-refusal is accepted. It is conservative,
    deterministic and tier 1 with a stated fix, and no corpus site forwards a handler.
  - (2) `composeSiteAddress` takes an excluded clause before a later clean one, unlike
    `selectorCandidates`. Both are proven unique, so it stays.
  - (3) The reworded arm and item refusals go to `writer` with the next copy pass.

- [x] LT-501: Authored `@scope` emission — native and lowered, the revised style errors, and the corpus cutover in one commit (ADR 0033 as revised 2026-10-07). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** test:server, typecheck, check:corpus, check:contract, build:docs, check:links, test:variants
  **Area:** compiler
  **Changed:** Compiled sheets are authored platform CSS (ADR 0033 as revised 2026-10-07/08): a prelude-less `@scope { … }` with author-written `to (…)` limits, the host idiom `:where(:scope)`, bare or relative descendants, tag-led and other top-level rules verbatim. Native emission adds the explicit root `@scope (<tag>)`. The lowered emission leads with `:where(<root>)`, pads a bare `:scope` to (0,1,0), and adds one guard per authored limit, re-including an own-tag instance below the limit or matched by it. The derived-boundary emission and `CompiledComponent.scopeBoundaries` are gone, and LTC051 compares authored sheets only. Diagnostics: LTC066 reworded, LTC069 on any `:global`, LTC071 re-scoped to limit-dead rules, LTC086 (`:host`) and LTC089 (unlowerable `@scope` forms, lowered targets only) new, LTC070 retired. All 50 compiled corpus sources moved by `scripts/migrate-scope-css.ts`, keeping the old boundary sets as `to (<tag> > *)` limits. Lowered corpus CSS is 102,044 → 172,605 bytes against `v3`, all of it guard cost; LT-502 removes unneeded limits.
  **Review:** Approved (2026-10-08) after one round (the `:where(:scope)` ruling). Accepted: lightningcss 1.33 refuses a relative selector at the top of `@scope`, so the compiler anchors it before parsing and flattening (`anchorRelativeSelectors`); `> my-tag .x` inside `@scope` is not LTC066. Nit fixed by the reviewer: a bare `:scope` ties the child's own `&.x` variant, so the docs no longer say it "outranks all three".

- [x] LT-502: Leak and unscoped-rule warnings from the compiler's knowledge of composed children (ADR 0033 s5); drop the corpus limits they show are unneeded. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-501
  **Gates:** test:server, typecheck, check:corpus, test:variants
  **Area:** compiler
  **Changed:** Two tier 2 warnings (ADR 0033 s5). LTC087 (downward leak): a rule in the component's `@scope` block whose subject can match an element a composed child renders in its own template, transitively through the registry, with no authored limit excluding the child; passed `children` content never counts (ADR 0048 s5); the fix-it is `to (<child-tag> > *)`. LTC088 (unscoped rule): a top-level rule neither in `@scope` nor led by the component's own tag. Corpus: 30 codemod limits removed, 8 kept; section-menu's docs-shell rules moved to `examples/_global.css`; `check:corpus` counts warnings outside `examples/test/**` only and prints fixture warnings on an uncounted line. The baseline is 1, module-dialog's `body.scroll-lock`. Lowered component CSS is 98,149 bytes (v3 before LT-501: 102,044).
  **Review:** Approved (2026-10-08). Ruling (owner, 2026-10-08): a page-wide rule goes where its owner is. Page-owned rules move to the page CSS; a component-bound one (a class the component's script sets on `body`) stays in the component and keeps LTC088; `examples/test/**` fixtures stay out of the baseline count. Accepted: LTC087 tests the subject compound alone and treats a dynamic attribute as a possible match, so it errs toward warning (why ticker, todo and codeblock keep `basic-button > *`). The single-guard option is dropped (owner, 2026-10-08): the lowered CSS already comes in under v3. The native bundler rejection of top-level relative selectors is LT-504. Nit fixed by the reviewer: LTC088's copy no longer tells a component-owned page-wide rule to move to the page CSS.

- [x] LT-504: Corpus — relative `> x` selectors in component `@scope` blocks become bare where limits keep computed styles; the native emission anchors the rest. — reviewed ✓
  **Area:** compiler
  **Needs:** LT-502
  **Gates:** test:server, typecheck, check:corpus, test:variants, build:docs, check:links
  **Area:** compiler
  **Changed:** Corpus: the 2.x child chains from the scope root are bare in 16 sources, every variant set byte-identical; three limits added where the bare form reaches a composed child (form-inplace-edit `to (form-textbox > *)`, form-colorgraph `to (form-spinbutton > *)`, module-coloreditor `to (form-colorgraph > *, module-colorinfo > *)`). Kept chains, each because the bare form would also match deeper own markup or passed content: combobox `> button`, spinbutton `fieldset > input`/`> button`, card-callout `> p`/`> *:last-child`, carousel `nav > button`, dialog `> button`. Native emission: a relative selector at the top of a component `@scope` ships as `:where(:scope) <combinator> …` (`nativeRules` runs `anchorRelativeSelectors`), so `bun build examples/main.css` passes under native targets; nested relative rules stay as authored. Docs teach bare descendants, relative only where bare would match deeper own markup. Computed-style diff of all 60 served pages: zero outside live data.
  **Review:** Approved (2026-10-08). Ruling (owner, 2026-10-08): the three limits stay rather than their chains. Built `main.css` vs v3: +14,624 raw, +577 gzip, +234 brotli; native pays nothing. Follow-ups: LT-505 (LTC087 misses static attributes at nested compose sites, confirmed on coloreditor `.hue`), LT-506 (dead-rule warning), LT-507 (remove the corpus's dead rules). Reviewer-side: ADR 0033 s3 now names the native anchor; s5 gains the dead-rule warning.
