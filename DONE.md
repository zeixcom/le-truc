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

- [x] LT-109: Migrate `module-calctable` to `.tsx` with same-commit cutover. — reviewed ✓
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-428, LT-429
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe for the reactive-list design. Must show: a list seeded from server args with per-field harvest (LT-429), handlers that write fields (`item.amount.set`), remove-on-zero through the key, a per-row derived price formatted from a raw source, and the trailing `data-unreconciled` entry row (LT-186). Both `.tsx` and `.tsrx` members; the `.ts` twin stays as a variant (ruling 5).
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

  **Changed:** `module-calctable` migrates to a compiled variant set — `module-calctable.tsx` (served) beside a `module-calctable.tsrx` twin (ADR 0039/0046); the hand-written `.ts` stays as the set's `.ts` twin (ruling 5). The entry's probe list, delivered: `rows` seeds `createList` from server args with per-field harvest (ADR 0046 s7 — the key from `data-key`, `description`/`amount`/`pricePerUnit` from their input `value` sites, `number` parsers inferred; reads spelled exactly, `String(...)` allowed); handlers write fields (`item.amount.set` in the row's own `onInput`/`onChange`); remove-on-zero goes through the key (`items.remove(k)` on the amount `change` commit); the per-row derived price is computed per item (`const price = createMemo(() => item.amount.get() * item.pricePerUnit.get())`, LT-426's per-item memo) and FORMATTED by a composed `<BasicNumber>` per row whose raw value arrives via `truc:pass` — the compose takes `lang`/`options` as server args, so the Intl formatting folds server-side per row exactly as `basic-number`'s own render does (LT-374's raw-source rule is satisfied by construction: the pass IS the raw source); and the trailing entry row is the LT-186 shape, `data-unreconciled` sibling of the map, committing through the three inputs' `onChange`. Authored `module-calctable.html` regenerated from the compiled server render (composed `basic-number` in the price cells, `entry-*`/`amount-total`/`price-total` distinguishing classes); `examples/main.css` imports the generated stylesheet; md rewritten (harvest-site contract, composed formatter); host profile gains the table skeleton intrinsics (`table/thead/tbody/tfoot/tr/th/td`, `input.step`/`inputmode`), `ModuleCalctableAttrs`, `BasicNumberAttrs` gains its `'truc:pass'` value surface; corpus-args gains `module-calctable` fixture rows; tier map moves `module-calctable` into `folded` (the classifier's decision on the compiled shape); parity/equivalence-audit/sim-driver snapshots extended.

  **How:** three compiler-expressibility constraints shaped the members, each hit as a hard diagnostic and resolved to the documented shape: (1) a list body reads only the item, the key, signals and `host` — never host-level consts, imports or function consts (LTC005's list-body face), so the clamp/Intl code became per-item memos, literals in handlers, and the composed formatter; (2) a per-item signal const cannot read `host` server-side (LTC046), and a setup const can be fed from EITHER args or DOM, not both — so the locale/options became `lang`/`options` args rendered on the root (basic-number's own contract) and formatting moved into the composed child; (3) structural uniqueness demands single-token discriminators, hence the `entry-*`/`total` classes. **Compiler gap found (needs a follow-up task, owner to file):** a host-declared `deriveList` consumed ONLY inside a list body (`rowPrices.byKey(k)` as an item const) compiles with NO diagnostic but the generated server module omits the `deriveList` declaration entirely — `ReferenceError: rowPrices is not defined` at render, caught by the sim realm during `build:docs`, never by the compiler. I restructured to the per-item memo (supported), so the shipped source never exercises the gap.

  **Check:** gates on the final code in the worktree: `typecheck` ✓ (0 errors, examples program included after the members joined `files`), `test:server` 3217 pass / 0 fail (snapshot diffs reviewed: the equivalence-audit connect diff is serializer normalization plus the composed basic-number clients writing their formatted text at mount — the designed boundary, no server-state overwrites), `check:corpus` ✓ (translation census 0 gaps), `check:contract` ✓, `build:docs` ✓ (the sim realm connects module-calctable during the build — it passed after the deriveList restructure; build:docs is the gate that CAUGHT the gap), `check:links` 731 ✓, biome clean on changed paths (snapshot re-pinned after the biome pass, per the LT-111 lesson). No `.spec.ts` exists in the folder, so `test:variants` skips it; smoke-checked over HTTP instead: `/test/module-calctable` 200, and BOTH surface bundles (`?surface=tsrx`, `?surface=tsx`) build and serve 200. Census: +1 entry, Folded (38 total, 30 Folded / 8 Simulated) — by design. Doubts for review: (1) the deriveList gap above is the headline; (2) the authored mirror's price cells carry static "CHF 37.50" text (the upgrade overwrites them; the un-upgraded page shows the steady state) and `value="0"` on the composed basic-number — the server-rendered args bake 0, the pass supplies the real value at mount, mirroring basic-number's own demo; (3) `input.value` thunks read through `String(...)`/harvest-sanctioned serialization only; the amount input shows `12.5` where the twin's `change` commit showed `12.50` — cosmetic, number inputs normalize; (4) `getNumberFormatter`'s validation logging no longer runs client-side for the totals (basic-number does its own options parsing inline) — the composed child reuses basic-number's exact contract, so behavior matches the sibling component rather than the twin's helper.
  **Review:** Approved (Architect, 2026-10-06). Every probe verified against the emitted artifacts, not just the sources: per-field harvest reads exactly the fields (String-sanctioned), the remove-on-zero commit goes through the key in the item's own listener, the trailing entry row is the LT-186 shape, and the formatted price composes `<BasicNumber>` with the raw value on a per-item memo — which folds the Intl formatting per row server-side through the child's own render, a better shape than the twin's hoisted formatter and squarely inside LT-142's fold rule. The tier moved to Folded by the classifier (hand-written was effectively Simulated); census 38 entries, 30 Folded / 8 Simulated — this entry's by-design change. Rulings on the doubts: (1) the headline deriveList gap is OUT of this task's scope — filed as LT-447 with the reproduction; the shipped sources never exercise it; (2) the mirror's static price texts and value="0" compose args are the designed pre-upgrade steady state, pinned by the audit snapshot; (3) the 12.5-vs-12.50 input display is accepted (number inputs normalize; the harvest rule bars toFixed on the site); (4) accepted — the composed child defines the formatting contract now, matching basic-number rather than the twin's helper. Reviewer nits fixed on the branch (ac34e2fe): stale mid-sentence splice in the .tsx docblock (deriveList draft residue), `ModuleCalctableAttrs.options` tightened to `string`. Gates re-run green on the branch after the nit commit (server suite 3217/0). No spec lives in the folder — the HTTP smoke check (test page + both surface bundles 200) and the sim-realm connect during build:docs stand in; a Playwright spec is not owed by this entry.

- [x] LT-111: Migrate `module-todo` to `.tsx` with same-commit cutover — last hand-written example, completes the corpus port. — reviewed ✓
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-427, LT-428
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe. Must show: store items from an empty seed, per-item `truc:pass` `{get,set}` into `form-checkbox` and the composed `FormInplaceEdit`, key-derived `id`/`for`, a reactive `disabled` from `items.length`, and remove through the key. Drag, keyboard reorder and the live region live in **one shared client-only helper module** called from every surface's setup (LT-427), replacing the module-level `idCounter` and the `let`s. Both `.tsx` and `.tsrx` members. The sweep check is ruling 5's, not "no `.ts` files remain".
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

  **Changed:** `module-todo` migrates to a compiled variant set — `module-todo.tsx` (served) beside a `module-todo.tsrx` twin (ADR 0039/0046); the hand-written `.ts` stays as the set's `.ts` twin per ruling 5, so this is a same-commit cutover of the SERVED surface. The reactive list is the keyed `map`/`@for` over `createList<TodoItem, MutableStore<TodoItem>>([], …)` (ADR 0046 s4): items are Mount Scopes showing the acceptance probes — per-item `truc:pass` `{ get, set }` into the raw `form-checkbox` (`checked`) and the composed `FormInplaceEdit` (`value`; only the static `name=""` arg, per LTC075), key-derived `id`/`for` (clone-time attributes over the key binding; the emitted `<template data-list="0">` carries none), a reactive `disabled={() => items.length === 1}` on the reorder handle, and remove through the key — the item's own `onClick={() => items.remove(k)}` replaces the twin's host-delegated remove. Drag, keyboard reorder, selection announcements and the live region live in ONE shared client-only helper, `examples/_common/reorder.ts` (LT-427), called as a bare client-only setup statement from both compiled surfaces (`setupReorder(host, container, items, liveRegion)`); the helper also owns `nextTodoId()`, replacing the module-level `idCounter`. The authored `module-todo.html` is regenerated from the compiled server render (form-radiogroup/pluralize/buttons stay raw authored; the add-item textbox composes `FormTextbox`); `examples/main.css` imports the generated stylesheet; the sheet is re-authored to ADR 0033 form — `:host`-led, with one `:global` rule for `basic-pluralize`'s `p` (past the scope boundary, the codeblock precedent). Host profile (wave-4 rule): new intrinsics `ol`/`fieldset`/`legend`/`footer`, `input.checked`, `ModuleTodoAttrs`, raw-leaf pass surfaces for `form-checkbox.checked`, `form-radiogroup` (no pass), `basic-pluralize.count` (now optional — pass is the other channel) and `basic-button.badge`. The md's descendant table drops the retired `first('template')`/`all(…)` rows; two spec probes added under "Compiled surface probes (LT-111)". `examples/tsconfig.json` lists the todo members; tier map +`module-todo: folded`; parity/equivalence-audit/sim-driver snapshots extended.

  **How:** members authored to emit byte-identical server renders and CSS (the set's LTC051 parity holds); mediated `set` params typed `(v: unknown)` with casts, the coloreditor convention, because the compose-site `PassEntry.set` is `(value: unknown) => void`. The item markup pairs the authored `label.label` (`for=${k}-checkbox`) with the composed inplace edit, so click-on-text still toggles the checkbox and label activation skips the interactive ✎/edit-input descendants.

  **Check:** gates inside the worktree, all on the final code: `typecheck` ✓ (0 errors), `test:server` 3204 pass / 0 fail (snapshot diff reviewed: module-todo's connect diff is serializer normalization + the pluralize client's designed source-locale writes + the passes' initial writes — no server-state overwrites), `check:corpus` ✓ (translation census 0 gaps), `check:contract` ✓, `build:docs` ✓, `check:links` 731 ✓, biome clean on the changed paths, and — contrary to recent precedent — `test:variants module-todo` RAN GREEN in the sandbox on all three surfaces (ts/tsrx/tsx, 52 tests each), including the two new probes, so the acceptance probe is live-proven against the hand-written twin as well. Sweep state for the trigger's confirmation (ruling 5's reading): folders still served hand-written outside `test/`, `docs/`, `_common` are `module-calctable`, `module-cem-list`, `module-ticker`, `section-menu` — the first two are LT-109/LT-110's scope per the chain; section-menu and ticker are unfiled as of this handoff. Doubts for review: (1) the helper registers `host.addEventListener` directly instead of the factory `on()` (not a standalone export) — no disconnect cleanup; behaviorally inert since the listeners sit on the host itself and the factory runs once per instance, but it deviates from the twin's `on()` hygiene; (2) the composed `FormInplaceEdit` renders `span.text` without the twin markup's `label.text` wrapper — the authored label now wraps the whole composed child; the unchanged spec (click-text toggles, dblclick opens, `:has(input:checked)` CSS) passes on all surfaces; (3) `getItemText`'s `label.text, span` selector falls through to `span.text` on every surface now; (4) `module-todo` enters the tier census as Folded (+1 Folded, 37 entries) — the census shift is this task's by-design change.
  **Review:** Approved (Architect, 2026-10-05). The diff is exactly the entry's probe list — empty-seed store list, mediated per-item passes into the raw checkbox and the composed inplace edit (only a static `name=""` arg, LTC075 respected), clone-time key-derived `id`/`for` (the emitted template carries none), the reactive `disabled` over `items.length`, and remove through the key in the item's own listener — plus the LT-427 helper shape the fixture modeled (`setupReorder(host, …)` as a bare client-only setup statement, import placed into the client module only). Every gate re-verified on the branch, `test:variants` green on all three surfaces in the sandbox. Rulings on the doubts: (1) the helper's raw `host.addEventListener` is accepted — the listeners sit on the host itself and the factory runs once per instance, so there is nothing to clean up on disconnect; only the transient pointer listeners ever needed removal, and they have it; (2) the label relocation is accepted — the authored `label.label` wraps the composed child, and the unchanged spec proves click-text-toggle, dblclick-edit and the `:has(input:checked)` CSS on every surface; (3) `getItemText`'s dead `label.text` alternative stays — it preserves the verbatim move from the twin's code; (4) the census shift is this entry's own by-design change. "Every surface's setup" reads as every COMPILED surface: the `.ts` twin keeps its inline logic untouched, per the migration practice ruling 10 records. Sweep state corrected from the handoff: `module-calctable` = LT-109, `module-ticker` = LT-110 (both filed, both need the same prerequisites this entry had); `module-cem-list` and `section-menu` are NOT in the queue — flagged to the owner; the iteration's exit criterion cannot close until they are filed or struck. No follow-up task owed by this review. Reviewer fix on v3 (c47fe9c7): re-pin the parity client-module snapshot — the contributor's final `test:server` run predated the biome --write pass on `module-todo.tsx`, so the snapshot held the pre-format wrap; full suite re-run green after (3204/0).

- [x] LT-186: A TSRX rule for an unkeyed element sibling of a `@for` in a reconcile container (LT-185's compiler half). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-371
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
  **Copy:** follows `writer` → error-messages; check it against LT-185's runtime message so
  the two agree (the ADR 0028 lifecycle applies — this introduces a code).
  Acceptance: the form-tokenbox shape at its pre-LT-185 state produces the diagnostic; a sibling
  carrying `data-unreconciled` does not, and neither does `module-list.tsrx` (whose container
  holds only the `@for`) — pin both negatives, the vacuous assertion is the failure mode; the
  compile-warning baseline stays at 0 over the corpus; `bun test server` green.
  **ADR 0037 rider (2026-09-21):** reactive conditions inside a reconcile container are
  **banned** (compiler, tier 1) until this rule exists — and this rule must also cover (or
  explicitly exempt) ADR 0037's arm templates as container children. See
  [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) sub-design 5.

  **Changed:** the compiler refuses an authored element (or composed element) beside a reactive-list loop inside the loop's reconcile() container when it carries neither `data-key` nor `data-unreconciled` — the list removes it on the first reconcile (new **LTC074**, tier 1 Prevented, an error not a warning, raised in shared loop analysis so both surfaces get it). The ADR 0037 rider is discharged: arm sets in the container stay LTC063's, and the new rule exempts them — their inert arm templates can never be container children through a legal compile; a non-duplication test pins that.

  **How:** the check sits in `runReconcileLoops` (`server/compiler/analysis/loops.ts`) right after the container query registers: it walks the container's children, skips the loop output and the `@empty` arm's roots (the server stamps those `data-unreconciled`, LT-212 — they sit in the tree as `output`'s siblings and would otherwise false-positive), flags `compose` children via `ComposeAttrIR`'s ref/arg/pass-only shape (a composed element can carry neither attribute, so its fix-it moves it out), and flags `element` children lacking both attributes. Diagnostic: `diagnostic.unkeyedSiblingInReconcileContainer`; copy agrees with LT-185's runtime message. Pins: a ranges test (positive + the `data-unreconciled`, bare-container and `@empty` negatives on both surfaces), a cross-surface parity case, a compose-fixture pin of the composed fix-it variant, and a corpus test compiling `module-list.tsrx` + `form-tokenbox.tsrx` front-end-plus-analysis clean. `features.test.ts`'s arg-seeded-harvest fixture carried the bug shape itself (a static header `<li>` with neither attribute — its runtime twin would have been removed) and now opts out via `data-unreconciled`; the harvest-filter assertion under test is unchanged. The LT-185 DEV_MODE advisory is untouched, per the entry.

  **Check:** gates in the worktree: `test:server` 2888 pass / 0 fail (after `build:docs` — a fresh worktree has no built docs/ and the serve-route tests read it), `typecheck` clean, `check:contract` ✓, `check:corpus` exit 0 with the compile-warning baseline still 0 and zero LTC074 hits — the false-positive probe ran before the rule was trusted, per the entry's "check the false-positive shape FIRST". `biome check` clean on the changed paths. Two doubts for review: **(1) the code is LTC074, not LTC073** — the stale session had drafted LTC073 before the `queue/ITERATION.md` 2026-10-04 note reserved LTC072 for LT-429 and LTC073 for LT-417 (in flight in a parallel worktree, 9 files deep); renumbered to the next free code with the ledger entry added — ITERATION.md's "next free diagnostic code" note now owes "LTC075". **(2)** a *server-mode* conditional directly in a reconcile container renders unkeyed element roots that the first run would also remove; the rule exempts `conditional`/`try` nodes entirely (no tag to name in the ruled message shape, which speaks element/compose) and no corpus component does this — worth a follow-up LT if that shape should be refused too.
  **Review:** Approved (Architect, 2026-10-05). LTC074, not LTC073, because LTC073 is LT-417's. LT-417's branch carries the additive merge resolution, so integrate this one first. A server-mode conditional directly in a reconcile container is LT-431.

- [x] LT-187: `reconcile()` misreports a DUPLICATE `data-key` as "key not present in the source" (LT-185 review finding). — reviewed ✓
  **Area:** runtime
  **Changed:** `reconcile()`'s DEV_MODE removal warning distinguishes a duplicate `data-key`
  from a genuinely absent one (`src/helpers/reactive.ts` `classify()`: at the removal branch
  `keySet.has(harvested)` exactly separates the two — the duplicate message names the collision
  and that the first occurrence wins); behaviour unchanged, only the message. Pins in
  `src/tests/reconcile.test.ts`: the duplicate on the adoption pass, the previously-untested
  absent-key message, and a duplicate introduced by external DOM mutation after the first run.
  CHANGELOG `Fixed` entry. Channel: runtime DEV_MODE advisory (REQUIREMENTS S3), not an
  ADR 0028 tier — the compiler emits `data-key` on `@for` items itself and cannot produce a
  duplicate; hand-authored `reconcile()` markup is the only source.
  **Review:** Approved.

- [x] LT-277: Seam hardening from the LT-267 review — glob dot-rule edges, `fileExists` contract, doc enumeration. — reviewed ✓
  **Area:** server
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

  **Changed:** the glob seam's two categorical holes are closed and the doc claims now hold. (1) A trailing `**` matcher keeps the dot rule: `matchGlob('mocks/**', 'mocks/.tmp')` and `matchGlob('**', '.hidden')` are false — the remainder has the interior `**`'s shape (zero or more dot-guarded directory segments plus one dot-guarded file). (2) Explicit-dot scan patterns adopted as runtime seam semantics (the entry's first branch, tier 2 Contained): a pattern segment starting with `.` (`.env`, `.hidden/*.ts`, `**/.rc`, `.*`) un-skips the dot entries it matches during the Node walk, mirroring `Bun.Glob`'s scanner, so a dot-prefixed source glob configures the same corpus under Bun and Node. (3) `node.ts` `fileExists` answers `stat().isFile()` — a directory answers false, matching the Bun half and the interface's "regular file exists". (4) Doc riders: SERVER.md's exception sentence is now complete (see How), and the portability diff report prints "first differing character at code unit N" from an `index`, not a `line`.

  **How:** `globToRegExp`'s trailing branch compiles the dot-guarded remainder; the walk (`scanGlobSync`) consults `dotSegmentMatchers(pattern)` — whole-name matchers over the pattern's explicit-dot segments, pruning only, with the full-path regex still deciding every yielded file — so walk and match agree by construction. `server/tests/runtimes.test.ts` pins the trailing-`**` rule on the matcher and seven dot-segment patterns scanned through ALL THREE paths (`scanGlobSync`, `nodeIO.scanGlob`, `bunIO.scanGlob` — the last being Bun's own scanner, so Bun-vs-walk parity is asserted directly), plus a scanned-path-passes-matcher sweep and the `fileExists(directory)` pair. SERVER.md's "No Bun.* outside the seam" list: the stale session had added the review's two missing files, but the "only exceptions" claim was still false — completed it with `routes.ts` (dev server), `contract-check.ts`, `measure-size-bet.ts`, and `lib/substrate-probe.ts` (grouped under `substrate-evaluation.ts`, its only consumer); verified by grepping `Bun\.` across scripts/ and server/ (corpus-config/corpus-sources hits are comment prose only). The i18n-sync rider is discharged by prior work: the script already walks the CONFIGURED scan (`collectCorpusSources` + `compileCorpus`, the LT-273 migration) — variant-aware, so `.tsx` declarers are covered; no glob is left to fold.

  **Check:** gates in the worktree: `bun test server/tests/runtimes.test.ts` 32/32; `test:server` full suite pass, 0 fail; `check:portability` 3/3 byte-identical; `typecheck` clean; `biome check` clean on the changed server paths. Notes for review: no repo glob uses explicit-dot segments or a trailing `**` today, so no configured behavior changes — the strictness only removes dot paths no scanner ever yielded. `scripts/corpus-portability-check.ts` carries a PRE-EXISTING biome format violation at HEAD (the multi-line `copyFileSync` at ~line 171); `scripts/` is outside `lint:server`'s scope (`./server` only), so it gates nothing — left alone to keep the diff on-task.
  **Review:** Approved (Architect, 2026-10-05). Explicit-dot segments adopted as seam semantics (tier 2 Contained, parity-pinned on all three scan paths). The i18n-sync rider is discharged by LT-273. The biome format drift in `corpus-portability-check.ts` predates this task, and `scripts/` is outside lint scope.

- [x] LT-280: Per-item effect channels in reactive-list loops — the lowering covers text fill + events and nothing richer (LT-266 evidence). **Ruled 2026-10-04 → ADR 0046.** — reviewed ✓
  **Area:** design
  **Ruled (owner + Architect, design session 2026-10-04):** recorded in ADR 0046
  (reactive-list items as Mount Scopes), with amendments to ADR 0024 s5, ADR 0032 s2 and
  ADR 0037 s5, and the **Mount Scope** term in `CONTEXT.md`. The four original questions:
  (1) items lower through the arm emission, which recurses (every channel at once); (2) the
  `.tsx` key spelling is `items.map((item, k))` on a new Cause & Effect `map`/`forEach`
  (handoff: `CAUSE_EFFECT_LIST_MAP.md`; LT-342 ruled with it); (3) a non-primitive reaching a
  text position is a TypeScript error on both surfaces, not an LTC rule, and items may be
  anything; (4) every component is expressible in every supported spelling, with no v3 release
  until that holds. module-todo's drag logic goes into one shared client-only helper module;
  module-ticker is nested lists (blocks → rows) with an empty-arm placeholder and a measured
  height from the sensor's `IntersectionObserverEntry`.
  **Session rulings with no ADR home:** a cleanup ambient is not added (`watch` handler cleanups
  already run before removal, `reactive.ts:891-904, 1033-1038`); per-field parser declaration is
  an open design question on LT-429; the probes are the migrations themselves (LT-425's
  module-list `.tsx` variant, then LT-109–LT-111), and acceptance criteria are goals, not
  constraints to satisfy by workaround (ITERATION ruling 10).
  **Implementation:** LT-422 → LT-423 → LT-424, LT-425 → LT-426; LT-427, LT-428 independent;
  LT-429 (design first) after LT-423.

- [x] LT-305: Baseline guard — fail the build when shipped code needs a feature newer than the pinned baseline (REQUIREMENTS § Browser support). **Ships in 3.0.** — reviewed ✓
  **Area:** runtime
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

  **Changed:** new tier-1 build gate `bun run check:baseline` (`scripts/check-baseline.ts`, scanner in `scripts/lib/baseline.ts`, CI step after `check:size`), the pin `"leTruc": { "baseline": 2023 }` in package.json, devDependency `web-features@3.40.1` (exact pin, data-only), and `CompiledSpanInfo` gains `cssPath`/`authoredCss` (additive). Green at HEAD.
  **How:** I chose a direct `web-features` mapping over browserslist plus a compat linter. web-features gives each BCD compat key its own Baseline date. TypeScript's checker (types `[]`, platform libs only) resolves member receivers through mixins and base interfaces to the BCD name (`api.Element.ariaLabel`, `javascript.builtins.Promise.withResolvers`). css-tree names CSS properties, values, selectors, at-rules, media features, functions and units. A small `SYNTAX_KEYS` table covers post-ES2020 syntax. A compat linter would add an ESLint stack that covers a curated API subset and no CSS. The scan covers `index.ts`, `src/`, cause-effect's source and the corpus compiled under `DEFAULT_CSS_TARGETS` (into `server/generated/baseline/`). Of the corpus output, only what the compiler added is judged: client findings inside emitter source spans, and emitted CSS keys the flattened authored sheet already uses, count as author code (REQUIREMENTS: the author's own baseline). They are listed but do not fail the gate. The allowlist holds exact keys with a reason each: `ElementInternals.states` and `CustomStateSet.add`/`.delete` (guarded in `bindState`), and `CustomElementRegistry.get` (a BCD data gap: no Safari support recorded on that key, though its feature is Baseline 2020). A stale entry fails the gate. The pin rule compares with the latest `v*` tag reachable from HEAD: the year may move only with a higher major. A release without a pin (v2.6.0) constrains nothing, and no reachable tag fails the gate (CI checkout is now `fetch-depth: 0`).
  **Check:** `bun run check:baseline` green; `test/baseline.test.ts` covers the 2024-API fixture failing, the year bump without a major failing, the syntax and CSS mapping, and allowlist staleness. Doubts for review: (1) the author/compiler split is my reading of REQUIREMENTS § Browser support. Judging corpus author code as-is fails on `cursor`, `user-select`, `:state()`, `light-dark()`, `backdrop-filter` and `getCoalescedEvents`. (2) Allowlisting the `CustomElementRegistry.get` data gap. (3) Coverage limits: `any` receivers, computed keys, Raw-folded CSS. No ARIA-on-internals key is detected because those writes use dynamic keys. Playwright not run (no example behavior change).
  **Review:** Approved (Architect, 2026-10-04). Ruling: only what the compiler adds is held to the pin. Author spans and the CSS features the authored sheet already uses are the author's baseline (REQUIREMENTS § Browser support): they are reported, not judged. The `CustomElementRegistry.get` allowlist entry is a BCD data gap, kept with its reason.

- [x] LT-334: An async boundary lazyload can be spelled in (LT-104 review). **Ruled 2026-10-06 → LT-449; `allow-scripts` decoupled to LT-448.** — reviewed ✓
  **Area:** design
  **Needs:** LT-276
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

  **Ruled (owner + Architect, design session 2026-10-06):** implementation task is LT-449,
  which carries the pinned shape. The rulings: (1) per-arm duplicated callout — the loading
  and error callouts are separate arms with `.danger` authored per arm; the arms-span-parents
  machinery extension is rejected (template-cloned arms make duplication free). (2) The ok
  arm is the reactive `truc:html` thunk on the content root; its `allow-scripts` question is
  DECOUPLED to LT-448 (a design session on partials bringing new components — owner's goal:
  build-unknown components, same-origin or CSP-approved origins, code-splitting required;
  `shake-hands` stays broken until it rules). (3) The scroll side effect stays a beside-watch
  (a sanctioned escape hatch, the `isPending` idiom's precedent) with a required ordering
  probe. (4) Stale dimming is the `isPending` idiom on the ok arm root. Original gaps
  re-scored: (2) retired by ADR 0037; (3) dissolved by arm cloning; (1) solved by `truc:html`
  modulo the decoupled `allow-scripts`; (4) beside. Also verified in the dive: sanitizer and
  `allowScripts` are mutually exclusive in the runtime (sanitization strips scripts before
  the re-creation pass), and the re-creation re-executes every script on every `ok` update.


- [x] LT-342: A `.tsx` spelling for the reactive-list key binding — capability parity (ADR 0032 s6), found by the LT-233 review. **Ruled 2026-10-04 with LT-280 → ADR 0046 s4; implemented by LT-425.** — reviewed ✓
  **Area:** design
  **Needs:** LT-280
  **Ruled (2026-10-04, with LT-280):** neither (a) as weighed here nor (b) nor (c). Cause & Effect lists gain `map((item, key))`/`forEach` (Map.forEach precedent), and `.tsx` spells the reactive loop `items.map((item, k) => …)` over a declared `createList`/`deriveList`; over an Array the second parameter stays the index (an accepted inconsistency, owner). `.tsrx` keeps `key k`. Implementation, including the `loopBindings`/`listItemHandlerFix` changes and the parity case, is LT-425.

- [x] LT-353: Reject unrecognized `truc:`-namespaced attributes at classification, on both surfaces (LT-251 review). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-371
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
  decidable, no runtime half). **Copy:** follows `writer` → error-messages (error-message lifecycle).
  **Check:** add a `diagnostic-parity.test.ts` row for a `truc:bogus` attribute on both
  surfaces; the corpus stays warning-free.

  **Changed:** the attribute classifier now rejects any `truc:*` name it does not recognize as LTC006, the same on both surfaces. A raw element accepts `truc:pass` and `truc:html`. A compose site accepts only `truc:pass`, so a `truc:html` there used to be forwarded as a dead server arg. The retired `truc:case`/`truc:case-type` point to the ICU pattern (ADR 0030 s4).
  **How:** `unknownTrucAttrReason()` in `server/compiler/classify-attributes.ts` runs after the recognized names in `classifyAttribute` and `classifyComposeAttribute`, and its message names the vocabulary that element kind accepts. Tests: parity rows for `truc:bogus` and `truc:case`, plus unit tests for the typo, the retired pair and a compose site. Docs: a `HOST_PROFILE.md` bullet and the LTC006 row in `skills/le-truc/references/errors.md`.
  **Check:** `bun test server/tests/compiler/tsx/diagnostic-parity.test.ts server/tests/compiler/diagnostics.test.ts`. Gates green: test:server (2888 pass), biome check server/, typecheck, check:contract, check:corpus (0 warnings), build:docs, check:links. Doubt: the compose-site arm goes a little beyond the entry's raw-element wording. It is the same silent fallthrough, so I included it. The copy could use a `writer` look.
  **Review:** Approved (Architect, 2026-10-04). The compose-site arm, which accepts only `truc:pass`, is in scope: it is the same fallthrough.

- [x] LT-355: A composed child inside a reactive-list template is silently dropped — render it, with its root `lang` and `i18n` (LT-351 ruling, ADR 0030 s9). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-423
  **Updated (Architect, 2026-10-04):** LT-423 (ADR 0046) makes a composed child in an item a supported construct and renders it into the `<template>`; this task keeps the locale half (its `lang`/`i18n` at the parent's effective locale) and the per-item-args refusal. The line citations below predate LT-423 — re-locate them (`listTemplateLines` is now `listTemplate`).
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
     no runtime half, identical on both surfaces (`diagnostic-parity.test.ts`). Copy
     follows `writer` → error-messages.
  **Pins:** a fixture parent whose list item nests a client-keyed child renders the child's
  `lang` and `i18n` inside `<template>` at de and none at en (after LT-354); a jsdom pin
  clones an item and the child formats in de; the item-hole case is the new LTC on both surfaces.
  **Check:** gates green; server goldens for module-list and tokenbox templates byte-identical
  (neither nests a compose).
  **Docs on landing:** `server/compiler/HOST_PROFILE.md` ("A client-created instance speaks the
  source locale") gets the revised rule.

  **Changed:** a composed child in a reactive-list item now has pins for the locale half of ADR 0030 s9, and a new **LTC075** refuses a composed child whose args or content read the item or key binding. LTC075 is tier 1 Prevented, statically decidable, with no runtime half. It replaces the `LTC005` face that LT-423 left. Item 1 needed no emitter change: after LT-423, `listTemplate` already renders the child's call at the parent's effective locale (`emitCompose`, ADR 0030 s3 precedence). The new tests pin that behavior; they did not drive it.
  **How:** `validateListBody` (`lower-shared.ts`) handles a `compose` node in its own branch. It checks every `arg` attribute, `class`/`id`/`data-*` included, and the child's content: non-reactive `{…}` children and server attributes of elements inside it. A reactive child there is already LTC011's, so it is skipped to avoid a double report. The old check saw only a compose that was a direct child of an element and only its args. The new branch also reaches compose sites in conditional and async-boundary arms. The builder is `diagnostic.composeReadsListItem` (first-draft copy). Its fix names `truc:pass`, the per-item channel LT-423 mounts. Docs: HOST_PROFILE (the client-created-instance rule is revised), LE_TRUC_COMPILER inventory, VOCABULARY_LEDGER, `skills/le-truc/references/errors.md`, CHANGELOG.
  **Check:** pins in `i18n-client.test.ts`: a `p-el` parent whose list item composes the `c-el` fixture renders `<c-el lang="de" i18n="…">` inside `<template data-list="0">` at de, and no `i18n` at en (`lang="en"` stays, because the fixture formats). The template bytes are identical on both surfaces. A jsdom clone of the template item upgrades and formats in de (`weitere Aufgaben`, `25 %` with a no-break space). Two parity cases in `diagnostic-parity.test.ts` pin LTC075 on both surfaces: an arg reading `item`, and content reading the key. Gates: `typecheck` ✓, `check:contract` ✓, `check:corpus` ✓ (0 LTC075 hits in the corpus), `build:docs` ✓, `check:links` ✓, biome clean on the changed paths. `test:server`: 3061 pass / 3 fail. All 3 failures are in `sim-driver.test.ts` "build-report baseline (LT-163)". They also fail on the base commit c59013a2 with this diff stashed: the `test-listitem-tsx` `InvalidPassPropertyError` classification now fires as `test-listitem`. They are pre-existing and need their own follow-up. Doubts: (1) `queue/ITERATION.md`'s next-free-code note now owes LTC076. (2) The LTC075 copy is a first draft. A `writer` pass on it is welcome.
  **Review:** Approved (Architect, 2026-10-05). Item 1 shipped with LT-423 (`listTemplate` → `emitCompose` at the parent's locale), so this task pins it; the pins pass on base too, which is correct for a pin. LTC075 subsumes LT-423's LTC005 face and reaches compose sites in arms and nested lists (the outer walk descends). The copy is no longer a first draft: `writer` reviewed it in 08219a7c. The red `sim-driver` LT-163 baseline predates this branch: LT-436 reworded the Mount Scope descriptor (`reconcile() item "…" did not activate`), and the two `test-listitem` classification regexes in `sim/classifications.ts` still expect `reconcile() did not activate`. That is LT-441.

- [x] LT-356: An unparseable or non-object catalog FILE is silent in the census and destroyed by `i18n:sync` (LT-249 review). — reviewed ✓
  **Area:** server
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
  unaffected. **Copy:** follows `writer` → error-messages.

  **Changed:** `readCatalogs` (now exported from `server/effects/i18n.ts`) tells an unreadable catalog file apart from an empty one. "Unreadable" means it does not parse, or its top level is not an object. `Catalogs.unreadable` is optional, so injected test catalogs still type-check. The census records such a file once, as a `malformed` record whose key is the file name (`de.json`), and skips that locale's declared-key walk, so no `missing` records appear. `i18n:sync` now reads through `readCatalogs`. It skips an unreadable locale, leaving the file and its manifest entries untouched, syncs the other locales, and then exits 1, naming the path and the parse error.
  **How:** Record shape: I reused the existing `malformed` status (it already covers non-string values per LT-249, with the reason given in `detail`) and put the file name in `key`. No new status, so `TRANSLATION_GAP_STATUSES`, the report buckets and the census types are unchanged. Updated the docs for `TranslationGap.key`, `LE_TRUC_COMPILER.md` and `i18n/README.md`. Added 3 regression tests in `server/tests/compiler/i18n.test.ts`.
  **Check:** I put a trailing comma in a scratch copy of `i18n/de.json` in the worktree and ran `bun run i18n:sync`. The census showed 1 record. Sync exited 1, named the file, and left `de.json` and `manifest.json` byte-identical (same shasum before and after). I then restored the file. Gates: test:server 2886/0, typecheck, check:corpus, check:contract and `biome check` on server/ and the script all pass, and build:docs passes. Doubts: (1) the generic `malformed` reason ("the entry is not a valid ICU pattern…") is a slightly loose fit for a whole file; the `detail` field carries the exact cause. (2) Sync still reads `manifest.json` with its own `catch {}` → `{}`, so an unparseable manifest would still be overwritten. That is outside this entry's scope and could be a follow-up.
  **Review:** Approved (Architect, 2026-10-04). Reusing `malformed` with the file name as `key` is the ruling for file-level records. The refused locale keeps its manifest entries, because the manifest is rewritten from the parsed object. An unparseable `manifest.json` is LT-430.

- [x] LT-374: Enforce the raw-value-source rule for formatted reactive values (D-20). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-371
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
  text cannot know the text was formatted. Copy follows `writer` → error-messages.
  **Verification:** a failing fixture per formatting kind; a passing `<data value>` and
  `<time datetime>` fixture whose harvest round-trips; corpus byte-identical or each change
  justified; full gates.

  **Changed:** new LTC059 (tier 1 Prevented, both surfaces): a signal seeded from server args whose only render site is formatted text, with no raw value source, fails the compile naming the reactive `<data value>` / `<time datetime>` / host-attribute fix; it replaces the generic LTC005 for that initializer. Half 2: a raw source rendered from a `number` arg (`<data value={count}>`, a host attribute) now harvests through `Number(…)` instead of seeding the attribute string; reactive `value`/`aria-valuenow`/`datetime` sites already harvested with a parser.
  **How:** `formattingOf` in `analysis/harvest.ts` recognizes formatting syntactically over the text thunk and, transitively, the setup consts it reads: any `Intl` read, `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` calls, and a declared message call whose pattern has a number/date argument. Pass 2 records the first formatted text site per signal. Pass 3 raises LTC059 when the arg substitution finds no raw site and nothing else already reported. `PassShared.rawSourceRefused` stops the duplicate LTC005 in `plan.ts`. The recognition rule is recorded in HOST_PROFILE bullet 6. Imported formatters (`getNumberFormatter`) are not recognized; they still get LTC005, never a formatted-text harvest.
  **Check:** `server/tests/compiler/raw-value-source.test.ts`: 8 failing fixtures (Intl direct and through a const, toLocaleString, toLocaleDateString, message plural/number/date, deriveCell) on both surfaces; 4 passing raw-source fixtures that connect in the simulation realm and re-render the server's formatted text; plus a parity case. Corpus output is byte-identical (diffed generated components before and after). Gates green: test:server, typecheck, check:contract, check:corpus (0 warnings), build:docs, check:links, biome. Doubts: (1) `number` harvests still use `asInteger` on direct sites (decimals truncate; LT-429 flagged this), while arg reads use `Number()`. (2) Boolean args are not coerced. (3) LTC059 can hide a co-occurring module-name LTC005 on the same initializer until the author fixes it.
  **Review:** Approved (Architect, 2026-10-04). Reviewer nit: `asParamType` moved above `paramDomRead`, which had taken its JSDoc. The `Number()` arg read versus `asInteger` on a direct site is LT-429's question.

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

- [x] LT-392: Regenerate the declared types and gate an arm-set client against them (LT-385 review finding). — reviewed ✓
  **Area:** compiler
  **Context (updated 2026-10-04, Architect):** the REGENERATION half has landed — commit
  3ed0814b refreshed `index.js` and the arm-form JSDoc, and 56c1a0be regenerated `types/src/`
  from current sources, so `types/src/helpers/reactive.d.ts:268` now declares `reconcile()`'s
  arm-form overload. What remains is the GATE half, so this cannot drift again: the declared
  surface lagged once because nothing checks an emitted arm-set client against it.
  **Original context (2026-10-02, LT-386):** `types/` was last regenerated at LT-361 and
  declared only `reconcile()`'s two list-form overloads. No corpus component emits an
  arm-set client, so `client.golden.test.ts`'s emit-then-check never exercised one; the
  first ever (LT-385's (g) fixture, `createCell(mode === 'wide')` over a `data-mode` DOM
  site) fails the golden tsc invocation with "Overload 1 of 2" — the arm-form overload does
  not resolve against the declared types. LT-389 already owns regenerating
  `types/src/helpers/reactive.d.ts` as a docs deliverable; this task adds the missing GATE
  so the declared surface cannot drift from the emitted clients again: confirm `types/` is
  current against the sources, then pin an emit-then-check of an arm-set client (the (g)
  fixture is the candidate) in the same shape as `client.golden`'s, so it runs on every
  suite pass rather than only when a docs build happens to refresh the artifact.
  **Check:** the arm-set client typechecks against the regenerated declared types under
  the golden invocation; `check:contract` stays green; run the full `build` to regenerate
  `types/` and diff for any other stale-surface drift landing in the same pass.

  **Changed:** `client.golden.test.ts`'s emit-then-check now compiles the LT-385g arm-set fixture (`createCell(mode === 'wide')` over `data-mode`, `@if`/`@else`) into the same tsc invocation, asserting it lowers through `reconcile()`'s arm form; verified it reproduces LT-385g's "Overload 1 of 2" against the pre-3ed0814b `reactive.d.ts` and passes against the current one. Full `build` regenerated `types/` with no drift (only `index.js`'s worktree-symlink path comment, restored). Gates: test:server 2883/0, typecheck, check:contract, check:corpus, build:docs green.
  **Review:** Approved (Architect, 2026-10-04). The async-boundary arm set is not pinned; it gets its first corpus consumer with LT-390.

- [x] LT-411: Teardown at `dispose()` runs after the realm's report is computed (LT-335 residue). — reviewed ✓
  **Area:** compiler
  **Changed:** `dispose()` settles the LAST render's tree before the restores and
  `window.close()` — the same teardown every earlier render got at the next window
  (`server/compiler/sim/realm.ts`; now `Promise<void>` and idempotent, timers the disconnect
  scheduled cancelled per LT-207's posture). The pass disposes before the report is computed,
  with the `finally` covering the error path (`server/effects/simulate.ts`). The seam member's
  meaning changed: `SIMULATION_SEAM_VERSION` 1→2 (`server/compiler/simulation/contract.ts`);
  SERVER.md's simulation paragraphs updated.
  **Review:** Approved. Reviewer nit: the two seam-typed `realm.dispose()` calls in
  `scripts/substrate-evaluation.ts` now await (efb3ad2a). Listnav's `window is not defined`
  notice ruled a harness-ordering artifact, not a component defect — post-fix the cleanup
  succeeds silently, so no `CLASSIFIED_DIAGNOSTICS` entry (one would bless the broken ordering).

- [x] LT-412: `watch(prop, { stale })` never fires when a Slot fronts a Task (found 2026-10-03, cause-effect skill rewrite). — reviewed ✓
  **Area:** runtime
  **Needs:** LT-425
  **Changed:** `@zeix/cause-effect` bumped to `^1.6.1` (package.json, bun.lock, rebuilt `index.js`).
  `watch('prop', { stale })` now fires when a `pass()`ed async thunk backs the child's Slot: 1.6.1's
  `match()` calls the free `isPending()`, which follows a Slot chain to its backing. `watch` is
  unchanged. The "literal Task" edge is retired from `skills/cause-effect/SKILL.md`,
  `skills/le-truc/references/runtime.md` and the AGENTS.md `stale` bullet. Pin: `reactive.test.ts`
  "stale fires through a Slot when a parent passes an async thunk (LT-412)".
  **Review:** Approved. Follow-up LT-437: the cause-effect skill still stamps itself 1.5.x and does
  not cover 1.6's list `map`/`forEach` or derived-list `stale`.

- [x] LT-414: Move the four non-comment "ADR 0023" citations in `server/compiler/` to ADR 0024 (LT-393 residue). — reviewed ✓
  **Area:** compiler
  **Changed:** the two generated-module headers (`emit-server.ts`, `emit-client.ts`) drop the
  ADR citation entirely (Architect ruling: a published artifact does not cite an internal ADR;
  milestone wording kept); the two diagnostic-copy sites (`analysis/effects.ts` async-boundary
  deeper-construct, `frontend/tsrx/compiler.ts` pinned-`@tsrx/core` grammar hint) cite ADR 0024
  (sub-design 13 = template-cloned arms; sub-design 2 = split compiler, pinned dependency).
  Six `.snap` goldens re-blessed; the only golden diff is the header lines.
  **Review:** Approved. Residue outside the task's scope (the same misattribution class in
  `server/effects/`, `server/tests/compiler/` titles and CEM tooling) filed as LT-434.

- [x] LT-415: Test servers take a free port; reuse a running server only when it is this checkout (owner, 2026-10-03). — reviewed ✓
  **Area:** server
  **Context:** `test:variants` (`scripts/test-variants.ts`, `PORT = 3000`), Playwright
  (`playwright.config.ts` `webServer.port: 3000`, `reuseExistingServer: true`) and 48 specs under
  `examples/` hard-code `http://localhost:3000`. A dev server left on 3000 makes `test:variants`
  refuse and lets `bun run test` silently test another worktree's or branch's build — and agent
  sessions cannot see or stop it. Specs use relative URLs (`page.goto('/test/<tag>')`) against
  Playwright's `baseURL`. `test:variants` always starts its per-surface server on a free port
  (`Bun.serve({ port: 0 })` or a probe), passes it to `serve.ts` and Playwright, and stops it after
  each surface. `bun run test` reuses a running server only when `/api/status` identifies the
  same checkout (repo root and default surface in a JSON body); otherwise it starts its own on a
  free port. `serve.ts`/`dev.ts` keep 3000 as the interactive default and accept `PORT`.
  **Channel/tier:** none — test tooling.
  **Check:** with a foreign server on 3000, `bun run test:variants` and `bun run test` both pass;
  with this checkout's `bun run dev` on 3000, `bun run test` reuses it; `grep -rn "localhost:3000"
  examples/` returns nothing.

  **Changed:** test servers take a free port and a run reuses a running server only when it is this checkout. `/api/status` now returns `{ status, root, surface }` JSON — the realpath'd repo root and the `TEST_SURFACE` override (`default` when unset); `serve.ts`/`dev.ts` keep 3000 as the interactive default and accept `PORT`. `test:variants` starts each surface's server on a free port, hands it to Playwright as `TEST_PORT`, and stops it after the surface. `playwright.config.ts` picks the port: `TEST_PORT` when a caller owns the server, else 3000 when `/api/status` names this checkout on the default surface, else a free port; its `baseURL` makes the 48 specs' addresses relative (`/test/<tag>`), and `examples/` is grep-clean of `localhost:3000`. Mock fragments (`/test/:component/mocks/*`) are no longer HMR-enhanced (deviation, below).

  **How:** new `scripts/test-server.ts` (`freePort`, `servesThisCheckout`, `CHECKOUT_ROOT`, `INTERACTIVE_PORT`) runs under both Node (Playwright's runner) and Bun, so it imports nothing from `server/`. The reuse rule compares `/api/status`'s `root` with the caller's own realpath and the `surface` the run expects; the config writes its port choice back to `TEST_PORT` so workers inherit it. **Deviation found on the way:** reusing a dev server injected the HMR script into mock HTML fragments (dev-mode `handleStaticFile` injects into every `.html`), and `module-lazyload` rendered the injected script text as fetched content — "handles empty content gracefully" failed on Chromium and WebKit against `bun run dev`. Mocks are innerHTML fragments, so the mock route now serves them with a fragment flag that skips HMR injection; regression test `development: mock fragments carry no HMR script` pins it. SERVER.md (route table, test-surfaces paragraph, Port and Startup) and `examples/test-setup.md` updated; dev.ts help text documents `PORT`.

  **Check:** foreign server on 3000 → `bun run test` exit 0 (990 passed, 10 pre-existing browser-conditional skips) and `bun run test:variants` exit 0 ("Every variant set passed on every surface"); this checkout's `bun run dev` on 3000 → `bun run test` exit 0 with `DEBUG=pw:webserver` printing "WebServer is already available" (reuse proven, twice: full suite and the lazyload spec); `grep -rn "localhost:3000" examples/` empty. Gates: `test:server` 2887/0 including the new `/api/status` identity, `TEST_SURFACE`, `servesThisCheckout` (same checkout / wrong surface / foreign server / free port) and mock-fragment tests; `typecheck` green; `biome check` on the changed paths clean. Not run: `check:size` (no `src/` change), `build:docs`/`check:links` (no docs-src or emission change). Notes for review: (1) the mock-HMR fix touches server output beyond the entry's literal text — it is what makes the dev-reuse acceptance achievable end to end. (2) `webServer.env` relies on Playwright merging it over `process.env` (verified in the installed 1.62.1 runner); `PLAYWRIGHT=1` also rides the command string. (3) The reuse check races a dev server dying mid-run — same exposure as any `reuseExistingServer` setup.

  Commits on `task/LT-415`: 5926cdb7 (server + config + scripts + docs) and f40bfb6f (the 48 spec conversions — first round left them unstaged via a wrong-cwd path list; same change, no content difference).
  **Review:** Approved (Architect, 2026-10-05). The mock-fragment HMR exclusion is in scope: dev-server reuse cannot pass without it. `/api/status` now reports the checkout's absolute path. That is acceptable, because the docs server is local tooling and the site ships as static `docs/`.

- [x] LT-416: Narrow LTC008's async-component range to the `async` keyword (LT-371 review). — reviewed ✓
  **Area:** compiler
  **Changed:** LTC008 on an `async` component function reports the `async` token instead of the
  whole exported statement (`front-end.ts` `runFrontEnd`: `indexOf('async')` from the statement
  start, fall back to the function node; the `fnStmt` local is gone) — ADR 0044 s1; in a
  single-component file the old range equaled the file and `lineLabel` printed no line. Code,
  severity and copy unchanged; narrowing a range is not a breaking change (LT-371 ruling).
  `tsx/diagnostic-parity.test.ts` drops the case's `spans` pair; `diagnostic-ranges.test.ts`
  pins the covered text `async` on both surfaces.
  **Review:** Approved.

- [x] LT-417: Refuse a `<style>` block that is not the root's single direct `<style>` child (LT-375 review). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-375
  **Context:** `resolveTemplateOutput` (`server/compiler/template-output.ts`) hoists only the
  first direct `<style>` child of the root. A second direct `<style>`, or one nested in a
  descendant element, compiles with no diagnostic on both surfaces: its CSS is dropped and an
  empty `<style></style>` renders into the host markup — a silent drop, predating LT-375. Since
  the owner ruling 2026-09-29 (ADR 0032 s1) a `<style>` child of the root is the only accepted
  place for the sheet, so refuse every other placement, naming the fix. Extend LTC060 or add a
  sibling code (next free: LTC072). Correct the JSDoc claim at `template-output.ts` ~70–72 ("no
  `<style>` placeholder can reach an emitter") in the same change.
  **Channel/tier:** compiler, tier 1 Prevented, in the shared hoist so both surfaces get it.
  Runtime: none (a source shape). Copy follows `writer` → error-messages.
  **Verification:** fixtures on both surfaces (a second direct `<style>`, a nested `<style>`);
  diagnostic parity; the corpus still builds; full gates.

  **Changed:** a `<style>` block that is not the root's single direct `<style>` child fails the compile (new **LTC073**, tier 1 Prevented, both surfaces, no runtime half): a second direct child of the root ("A second `<style>` block in the root") and one nested in any descendant ("A `<style>` block nested inside an element"), each told that its CSS would be dropped and to merge its rules into the root's single `<style>` child. The JSDoc claim at `template-output.ts` ("no `<style>` placeholder can reach an emitter") is corrected in the same change, as the entry required.

  **How:** the check lives in `resolveTemplateOutput` (the shared hoist, `template-output.ts`): after the first direct `<style>` child is hoisted as the stylesheet, a `walkTemplate` over the root flags every `<style>` element still in the tree, `parent !== root` selecting the nested message variant — composed content included. Diagnostic: `diagnostic.misplacedStyleBlock(source, at, nested)`. The code is **LTC073, not LTC072**: the entry's "next free" predates the 2026-10-04 iteration note that reserves LTC072 for LT-429; the VOCABULARY_LEDGER entry documents the skip. Pins: two cross-surface parity cases (second-direct and nested) with covered-text spans — the second-direct case deliberately trips on the test builders' own trailing `<style>` block, proving the hoist keeps only the first. Docs updated in the same change: HOST_PROFILE.md's output-shape bullet, LE_TRUC_COMPILER.md's stylesheet family, the errors catalog, `compiled.md`, and a CHANGELOG Added bullet.

  **Check:** gates in the worktree: `test:server` 2885 pass / 0 fail (after `build:docs` — fresh worktree), `typecheck` clean, `check:contract` ✓, `check:corpus` exit 0 with zero LTC073 hits and the compile-warning baseline still 0 (no corpus component keeps a misplaced block — the LT-375 migration had already moved them all), `biome check` clean on the changed paths after one format pass over the new parity cases. No doubts; the entry's verification line (fixtures on both surfaces, diagnostic parity, corpus builds, full gates) is satisfied in full.
  **Review:** Approved (Architect, 2026-10-05). Review commit 395791a1 merges `task/LT-186` into this branch and keeps both LTC073 and LTC074: the two branches append to the same union and ledger lines. Integrate after LT-186.

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

- [x] LT-422: The Value Harness follows the signal meaning — lists iterate cells, store fields are cells; `createSensor` is a signal constructor (ADR 0046 s3, s5). — reviewed ✓
  **Area:** compiler
  **Changed:** the Value Harness follows the signal meaning (ADR 0046 s3, s5;
  `server/compiler/runtime.ts`). `ServerList` iterates the item cells it hands out
  (`createItem`'s result, a cell by default), keyed as Cause & Effect keys the same seed, and
  gains `length`, `at`, `keys()`, `byKey()`, `map((cell, key))` and `forEach`; `entries()` stays
  internal to the emitted loop. `createStore` fields are signals (nested objects stores, arrays
  lists) and `get()` returns the whole value. `deriveList` returns the same list and passes
  `keyConfig` through. `createSensor` is a signal constructor (`vocabulary.ts`, the IR's
  derived family): its `{ value }` seed is its server value, and an unseeded one is
  Unresolvable (out of `serverKnown`, one `LTC013` routing signal) and skipped by the harvest.
  The bare `{item}` fill emits `text(item.get())`. A harness export named inside `expose()` is
  imported from the harness, not stubbed. Rendered HTML unchanged; the `module-list`,
  `form-tokenbox` and `context-media` server modules changed by design. `LE_TRUC_COMPILER.md`
  §4/§5.3 updated; tests in `server/tests/compiler/value-harness.test.ts`.

  **Review:** Approved (Architect, 2026-10-05); Playwright, `test:variants` and all three
  `check:sim` legs run green by the owner. Accepted as is: an unseeded sensor routes at its
  declaration, not per server read, which follows the context-reading-derive precedent
  (`setup-extraction.ts`); a sensor seed resolves against an empty scope, so a seed that reads
  a server arg counts as Unresolvable. CONTEXT.md's **Value Harness** entry was updated by the
  reviewer.

- [x] LT-423: A reactive-list item is a Mount Scope — item content lowers through the arm emission (ADR 0046 s1–s3). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-422
  **Gates:** check:sim
  **Changed:** a reactive-list item is a Mount Scope (ADR 0046 s1–s3). Item content — reactive
  attributes, class/style maps, `truc:pass` into composed children, events, lazy text children
  over the item, key-derived `id`/`for` set once at clone — plans through the arm machinery
  (`planReconcileItem`, pass 4 in `analysis/effects.ts` → `ReconcilePlan.itemScope`) and mounts
  in `bindItem` against the item's own `first`. The extracted `<template>` is stamped
  `data-list="N"` (compile-time document-order index, `walk.ts` `listIndexOf`) outside the
  container and queried from the container's parent — the one-list-per-component limit is
  lifted. Retired refusals (LTC005 arms; parity-pinned on both surfaces): `validateListBody`'s
  slot-fill restrictions (one hole, server-static-only, no control flow, no client constructs),
  the handler-reads-item refusal with its `listItemHandlerFix` wording key, the second-list
  refusal. Remaining refusals: item with other than one root; host-level `first()` into an item
  (`template-output.ts` + `analysis/compose-refs.ts`); server attrs reading the item; arm sets,
  plain boundaries and nested loops inside an item (nesting lowering is LT-424). The server
  bakes item-dependent sites empty (ADR 0037 s1's losing-arm rule) and renders server-known
  conditionals' winner and composed children into the template; the harvest refuses an
  arg-seeded list whose body renders the item nowhere. **Runtime rider (same change):**
  `reconcileList`'s `enter()` now inserts a cloned item BEFORE mounting it — the order
  `reconcileArms` already used — so a `pass()` in `bindItem` validates an upgraded composed
  child instead of throwing uncaught (regression test in `src/tests/reconcile.test.ts`).
  `index.js` bundle regenerated. Fixtures on both surfaces at `examples/test/listitem/`
  (separate tags, not a variant set): store item, reactive attribute, `truc:pass {get,set}`,
  handlers reading the item, key-derived `id`/`for` (`.tsrx`; the `.tsx` keyed map is LT-425).
  Tier census +2 Folded (`test-listitem`, `test-listitem-tsx`) — the ADR 0046 fixture pair;
  warning baseline stays 0.
  **Review:** Approved. Reviewer nit: `listIndex` JSDoc named the container as the query root
  (22d2af7c). Realm classifications for the two fixture tags document the fixed-point
  re-parse's parent-first connect (Contained, per-descriptor; real pages upgrade children
  first — verified in plain jsdom and Chromium/WebKit). `reconcile()`'s JSDoc does not yet
  state the insert-before-mount ordering contract (pinned by the unit test); the uncaught-throw
  containment gap on a re-run predates the task → LT-435.

- [x] LT-424: Mount Scopes nest — arms and lists inside arms and items, scoped server-data loops, the cross-scope uniqueness proof (ADR 0046 s1–s2). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-423
  **Gates:** check:sim
  **Changed:** Mount Scopes nest (ADR 0046 s1–s2). Emission recurses: an arm set, a reactive list or
  a server-data loop inside an arm or a list item plans into that scope's mount through its locals
  (`MountScope`, `planNested`/`planNestedList`/`planNestedEach` in `analysis/effects.ts`). Lifted:
  arm sets and lists inside arms; arm sets, lists, server-data loops and async boundaries inside
  items. A condition over an item or key is reactive and folds per live item. Still refused: arm
  sets in server-rendered branches, composed content and server-data loop bodies; LTC063. New
  refusals (LTC005, parity-pinned): a list directly under an arm or item root, a list inside a
  server-data loop body, a server-data loop over the item or key, an arg-seeded nested list. The
  cross-scope proof is `resolveScopedSelector` (`analysis/selectors.ts`): proved on the materialized
  probe, with a synthesized `:scope >` child path when no class, role or `data-*` separates; LTC007
  otherwise. A scoped server-data loop is a static query, no `all()`. Nested templates ride inside
  the outer one; `data-list` indices are pre-order. A reactive list's `@empty` arm binds reactive
  attributes, maps, events and lazy text. Key-derived attributes generalize to every enclosing key,
  set at the owning scope's mount, through server-rendered branches in both arm and item walks; a
  key-only element in a server branch gets a non-throwing local (`ScopeLocal.optional`). Census 38
  (30 folded / 8 simulated), warning baseline 0, goldens byte-identical.
  **Review:** Approved after rework (8cfbced5): the dropped key-derived attribute in a nested arm's
  server branch, and the new LTC005/LTC007 copy. Accepted without rework: host-level `first()` keeps
  LTC007 without child-path synthesis; the child path skips the composed-children exclusion (a step
  names the enclosing element's tag, so it can only match into a composed child that shares an own
  element's tag); the `@empty` lift covers events and lazy text; `holderOf` looks through control
  flow. Follow-up LT-439 (module-level `.tsrx` types).

- [x] LT-425: The `.tsx` keyed `map` — `items.map((item, k) => …)` over `createList`/`deriveList`, Cause & Effect 1.6, a module-list `.tsx` variant (ADR 0046 s4; closes LT-342). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-423
  **Changed:** the `.tsx` keyed `map` (ADR 0046 s4). Over a declared List, the `.map()`
  callback's second parameter is the item's key (`LoopSource.keyOverList`, swapped in as `key` by
  `lowerLoop`), the `.tsx` spelling of `@for`'s `key k`; over an Array it stays the index. The
  key-binding checks (reserved names, bare identifier, key-derived attributes) run on both
  surfaces and are parity-pinned; a List `.map()` with 3+ parameters is LTC005; `surface.ts`
  gains `keyBindingShape`/`keyBindingExample`. `deriveList` is a reconcile source beside
  `createList` (LTC001 copy updated): no list-seed harvest (derive-callback route), the client
  keeps the whole call so `keyConfig`/the item callback survive, and the server harness gains the
  `(source, itemFn)` form keyed by the source. `examples/module/list/module-list.tsx` is the
  served member of the module-list variant set (CSS, server render, registry entry identical);
  the listitem `.tsx` twin gains key-derived `id`/`for` and the spec asserts it on both surfaces.
  Host profile: `module-list`, `basic-button` (`truc:pass` `disabled`), `form` `action`/`onSubmit`.
  `parity.test.ts` registers the whole corpus (module-list composes a non-member).
  `CAUSE_EFFECT_LIST_MAP.md` deleted.
  **Ruling (owner, 2026-10-05):** the extracted item `<template>` no longer bakes the slot-fill
  `<slot></slot>` for a bare `{item}` — a vestige of the path ADR 0046 s1 retired, and the marker
  ADR 0024 s10 rejected for its Declarative Shadow DOM collision. Every lazy child bakes empty,
  so both surfaces emit the same template bytes; goldens, sim/equivalence snapshots and the
  `module-list`/`form-tokenbox` fixture pages changed accordingly.
  **Review:** Approved. Reviewer nit: `keyOnServerDataFor` JSDoc quoted the retired arity
  message (6ce5d686). Playwright run by the owner in the worktree (sandbox could not drive the
  browser): all green. Noted, no task: module-list has no Playwright spec; the harness
  `deriveList` source form does not run async item callbacks.

- [x] LT-426: Per-item setup — the `map` block body and `@for` statements classified by the setup rules; selectors may name the scope root (ADR 0046 s2, s5). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-424, LT-425
  **Gates:** check:sim
  **Context:** A reactive list body refuses every statement today (`lower-shared.ts:1045-1062`,
  "A hoisted const in a reactive-list body"). ADR 0046 s5 runs the component-setup
  classification (`setup-extraction.ts`, shared by both front ends) per item, with the item and
  key as known names:
  1. **Statements:** plain `const`s (both phases; per initial item on the server, in `bindItem`
     on the client); signal declarations over the item (the harness evaluates once, the client
     per item); `first()` refs against the item's `first`; client-only side effects
     (`watch`/`on`/`pass`) in `bindItem` only. Everything else is LTC005 with component setup's
     message.
  2. **Scope root:** a selector in a scope that matches the scope root resolves at build time
     and emits the root parameter (`_element`/the arm root), not a query.
  3. **Scope-declared lists** are loop sources: a `deriveList` declared in an item's setup
     drives a nested list (LT-424).
  4. Arms take no setup statements (ADR 0046 s5); a `.tsrx` `@if` body statement stays refused.
  **Channel/tier:** compiler; parity cases on both surfaces.
  **Check:** fixtures on both surfaces: a key-derived `const`, a per-item `createMemo`, a
  `first()` naming the item root, a per-item `createSensor` with a seed driving an arm or empty
  state, a nested list over a scope-declared `deriveList`. Full gates.
  **Impasse rule (iteration ruling 10).**

  **Changed:** per-item setup (ADR 0046 s2, s5). A reactive list's body statements — the `.tsx` `map` callback's block body, the `.tsrx` `@for` body — are the item's setup, classified by `extractItemSetup` (`setup-extraction.ts`, shared by both front ends) into `ItemSetupStmt`s on `ReconcileForIR.setup` (flattened as `ComponentIR.itemSetup` for import placement and client-needed names). Plain `const`s and signal declarations run in both phases (declared per initial item inside the server's loop, per entering item in `bindItem`); `first()` resolves against the item's own content, and a selector naming the item root emits `bindItem`'s element parameter (`const row = _element as ElementFromSelector<…>`); client-only side effects (`watch`/`on`/`pass`) run in `bindItem` only. Per-item names are bound while the output lowers (reactive by position: a condition over one switches arms in the item); an attribute over the item's consts and key alone is clone-time (baked empty in the template, set once at mount, in arm mounts too); a scope-declared `deriveList` drives a nested list; the `.tsrx` bare `{sig}` shorthand works over a per-item signal. `.tsx`: `watch`/`on` directly in a List `map` callback body is no longer LTC045. New LTC005 refusals (parity-pinned): a both-phase position reading a server arg or a client-only name (function-const bodies and `createSensor` start callbacks may read client-only names — the server stubs them as `any` or omits the function), an unseeded/unresolvable per-item `createSensor`, `expose()` and `requestContext()` in an item, `first()` into a nested arm/item (plus LTC026/LTC027/LTC040 as for component refs); anything else gets component setup's message verbatim. The old "hoisted const in a reactive-list body" refusal is retired. Docs: HOST_PROFILE.md (per-item setup paragraph, statement-context notes), LE_TRUC_COMPILER.md (IR, module map).
  **How:** `lower-shared.ts` `lowerListLoop` (extract under the item/key binding, lower the output with per-item signals and `setupInits` overlaid; `resolveItemRefs`; `validateListBody` generalizes key-derived to clone-time names); `emit-server.ts` `emitItemSetup` + `listTemplate` clone-time skip and `templateUnbound`; `emit-client.ts` `emitItemSetup` in `emitReconcile`; `analysis/effects.ts` `planReconcileItem` widens `itemNames`/`keyNames`; `initial-winner.ts`, `fold-inputs.ts`, `imports.ts`, `module-scans.ts`, `plan.ts` (usedNames, message keys) follow.
  **Check:** `server/tests/compiler/item-setup.test.ts` (both surfaces, byte-identical modules, realm-driven: key-derived const, per-item `createMemo`, root `first()`, seeded `createSensor` switching an arm, side effect, nested list over an item-declared `deriveList`, `.tsrx` shorthand) and the `per-item setup (LT-426)` block in `tsx/diagnostic-parity.test.ts`. Gates: test:server 3094 pass / 3 fail (the LT-441 baseline only); typecheck, check:contract, check:corpus, build:docs, check:links (729) green; lint (biome on changed paths) clean; check:sim node≡bun green, Deno leg unrunnable in sandbox (dl.deno.land denied / cause-effect 1.6.1 under Deno's min-age policy); test:variants not run (no variant set touched; Playwright not drivable here). Doubts for review: (1) refusal of a non-function per-item const reading a client-only name (top-level routes such a const Simulated instead) — I read "plain consts (both phases)" as a constraint; (2) a per-item const reading the item is a snapshot and, in an attribute, is set once at clone like a key-derived one; (3) `expose()`/`requestContext()` in an item get their own message rather than component setup's (whose copy lists `expose()` as allowed); (4) an item `first()` that matches nothing but names a custom tag is emitted unverified (composed child); (5) new error copy may want a writer pass.
  **Review:** Approved (Architect, 2026-10-05). `extractItemSetup` (`setup-extraction.ts`) classifies item setup by the component rules with item, key and enclosing items' names known; IR `ItemSetupStmt` on `ReconcileForIR.setup`; root-naming `first()` emits `_element`. Rulings on the contributor's doubts: (1) a non-function per-item const reading a client-only name is refused, not routed to Simulated — an item const has no server value and the server renders every initial item from it; (2) an item-reading const is a snapshot, set at clone like a key-derived value; (3) `expose()`/`requestContext()` keep their own messages, since component setup's copy names `expose()` as allowed; (4) an unmatched custom-element `first()` is emitted unverified, as at component level. The new refusal copy gets the `writer` pass with the iteration's changelog. `check:sim` Deno leg and `test:variants` are the owner's (sandbox). **Integration with LT-442:** whichever lands second adds `import { css } from '@zeix/le-truc-compiler/macros'` to the inline `.tsx` sources of `item-setup.test.ts` (`STYLE_TSX`) and LT-426's new `diagnostic-parity.test.ts` block — without it the sheet compiles empty after LT-442.

- [x] LT-427: An imported function is a known name in a client-only setup side effect (ADR 0046 s5). — reviewed ✓
  **Area:** compiler
  **Changed:** no compiler behavior change. The entry's premise did not hold: `clientKnownName`
  (`server/compiler/setup-extraction.ts`) has admitted authored non-compose import bindings since
  LT-088. Pinned by `server/tests/compiler/imported-setup-helper.test.ts` (both surfaces: clean
  compile, import and call in the client module only, byte-identical modules, a compose import
  stays LTC005); the gate comment lists import bindings; `HOST_PROFILE.md` → Imports states the
  rule.

  **Review:** Approved (Architect, 2026-10-05). Pinning an already-true behavior closes the task.
  Imports in per-item setup (`map` block body, `@for` statements, ADR 0046 s5) stay LT-426's.

- [x] LT-428: Every compiler-emitted text sink takes `string | number`, on the server and the client (ADR 0046 s6). — reviewed ✓
  **Area:** compiler
  **Changed:** every compiler-emitted text position takes `string | number` (ADR 0046 s6); an
  object or a boolean fails tsc at the authored line on both phases and both surfaces. The server
  renders text through new harness sinks `text`/`textOf` (`server/compiler/runtime.ts`,
  `TextValue = string | number | null | undefined`; nil renders empty, where it rendered
  "undefined" before). The client async-boundary arms now write through `bindText`. Sink statements carry
  spans so `check:corpus` reports at the authored line. Consequences: a bare `{e}` in a catch arm
  is a tsc error (the analysis hint now asks for a text member, e.g. `{e.message}`), the server
  catch parameter is typed `Error`, and `.tsrx` drops `{/* comment */}` children as `.tsx` does.
  `check-corpus.ts`'s header covers both surfaces; `LE_TRUC_COMPILER.md` documents typed text
  sinks. Tests: `server/tests/compiler/text-sinks.test.ts`.

  **Review:** Approved (Architect, 2026-10-05); Playwright and `test:variants` run green by the
  owner (sandbox times out page loads). The JSDoc's field fix (`{() => item.get().label}`) only
  compiles once ADR 0046 s1 lands, so the test pins the ternary fix alone. A compiler-wrapped
  expression maps through a synthetic slice: line exact, column approximate.

- [x] LT-429: Per-field harvest for list items seeded from server args — parsers inferred or declared with `harvest()`; LTC072 for a field with no harvest site, LTC076 for a field with no parser (ADR 0046 s7). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-423, LT-439, LT-440, LT-442
  **Gates:** check:corpus
  **Context:** The `list` harvest (`emit-client.ts:164` `listDeclaration`) rebuilds each adopted
  item from one slot's `textContent` — strings only. ADR 0046 s7 (ruled with the owner,
  2026-10-05) harvests each field from its canonical render site and settles how each field gets
  its parser. Only lists seeded from server args are in scope (a literal-array seed, as in
  `test-listitem`, is not harvested).
  1. **Sites.** Per field, inside the adopted item: a direct text child, or an attribute/property
     whose arrow reads exactly the field, unformatted; first in document order. A field the
     `keyConfig` returns verbatim comes from `data-key`. Each site reads the way the scalar harvest
     reads that site kind today. A formatted-only site needs a raw source (LT-374's LTC059, per
     field).
  2. **Inferred parsers.** Resolve the item type syntactically: the declaring call's type argument
     (`createList<CalcItem, …>`), else the element type of the seed arg's annotation; follow a
     same-file `type` alias or `interface` (no `extends`) to its members, or read an inline type
     literal. `string` and string-literal unions → `asString`, `number` → `asNumber` (LT-440's
     mapping), `boolean` → `asBoolean`. Anything else, or an unresolvable type, has no inferred
     parser.
  3. **`harvest()`.** Add `harvest<T>(seed: T[], parsers: { [K in keyof T]?: Parser<T[K]> }): T[]`
     to `server/compiler/macros.ts` (LT-442's subpath; same throwing stub, specifier+binding
     recognition, stripped from both modules), recognized only as the seed argument of
     `createList`. An entry overrides inference. For an unresolvable item type the map's keys are
     the field list. Entries are spliced into the client as authored; a free name the client cannot
     resolve is LTC005's client-position face. The server reads the seed through as identity.
     Leave the scalar overload to LT-443, but shape the recognition so it adds one.
  4. **Typed result.** The generated harvested array is checked against the item type: by the
     declaring call's explicit type argument where present, else by `satisfies <element type>[]`
     spelled from the seed arg's annotation. A wrong parser type, or a field missing from the map of
     an imported type, is then a tsc error, mapped to the authored line on both surfaces.
  5. **LTC072** — compiler, tier 1 Prevented, statically decidable: a field with no harvest site.
     Copy names the field and the fix: render it raw (`data-<field>` on the item root, or
     `<data value>`). **LTC076** — compiler, tier 1 Prevented, statically decidable: a field with a
     site but neither an inferable type nor a `harvest()` entry; the copy names the field and its type
     text and shows the fix, `harvest(items, { <field>: … })`. Both per `writer` → error-messages;
     update `ITERATION.md`'s code ledger in the handoff.
  **Check:** a calctable-shaped fixture round-trips a seeded `{ id, description, amount,
  pricePerUnit }` set on both surfaces, `pricePerUnit` keeping decimals; an imported item type
  compiles with a complete map and fails tsc with a field missing; a `Date` field round-trips
  through an authored parser; a wrong parser type is a tsc error at the authored line; an
  unrendered field fails LTC072 and an unparsable one LTC076, on both surfaces. Full gates.

  **Rider (Architect, 2026-10-05, from LT-442):** `shadowMarkers` drops only the names the component function's own scope declares (args and top-level setup). That suffices for `css` (a `<style>` is a direct child of the root); `harvest()` can appear in item setup and nested scopes, so resolve its binding against the enclosing scopes there — extend `shadowMarkers`/`markerOf`, do not fork them.

  **Changed:** A `createList` seeded from server args is now harvested field by field (ADR 0046 s7). The field `keyConfig` returns verbatim (`row => row.id`) reads `data-key`. Every other field reads the first text child or arrow attribute in the adopted item that reads exactly the field (`item.f.get()`, `item.get().f`, optionally through `String()`). A dirty-flag attribute reads the live property. Each field goes through a parser: the `harvest()` entry if there is one, else the parser its type infers (`string` and string-literal unions → `asString`, with a cast to the union; `number` → `asNumber`; `boolean` → `asBoolean`). The item type comes from the first type argument, else the element type of the seed arg's annotation, through a same-file alias or an `interface` without `extends`. `harvest<T>(seed: T[], parsers: { [K in keyof T]?: Parser<T[K] & {}> }): T[]` is added to `macros.ts` as an overload, so LT-443 adds one signature. It is recognized by binding (`MARKER_NAMES` + `harvestCallOf` → `markerOf`). `markerOf` takes `enclosing` scope names, which an item's setup passes (binding, key, setup names, enclosing items), and `shadowMarkers` shares the same `withoutShadowed` helper. The server reads the seed through: the setup statement is rewritten to the seed, with `SetupStmt.slices` mapping around the cut. The client splices the rebuilt array over the marker call. New codes: LTC072 (a field with no site, located at the item root) and LTC076 (a field with a site but no parser, located at the seed; also covers the whole item when the item type is unreadable and has no `harvest()` map). LTC059 fires per field when a field's only site formats it. `harvest()` anywhere else is refused with LTC005: on a literal seed, in item setup, or outside a `createList` seed. A `string`/untyped item keeps today's whole-item hole path. Docs: HOST_PROFILE (a *Per-field harvest* paragraph and the markers paragraph), LE_TRUC_COMPILER (module table and inventory), VOCABULARY_LEDGER, CHANGELOG, `skills/le-truc` errors.md and compiled.md. **ITERATION.md's code ledger:** LTC072 and LTC076 are now used (LT-429).
  **How:** New `server/compiler/list-item.ts` (front end: `collectModuleTypes`, `resolveListItem`, `harvestCallOf`; `ExtractContext.moduleTypes`) and `server/compiler/analysis/list-harvest.ts` (Pass 3: sites, parsers, diagnostics). `DeclaredSignalIR` gains `harvest`/`listItem`, and `HarvestPlan.list.seed` gains `{ container, fields: ListFieldPlan[] }`. `emit-client.ts` adds `fieldListDeclaration`. Import placement credits `harvest()` entry names to the client, and the setup texts and item type text as type uses, so an `import type` item type is placed. **Deviation:** the entry asked for `satisfies <T>[]`. The rebuilt item is typed by the map callback's return annotation instead (`.map((el): CalcItem => ({…}))`), using the explicit type argument's text or the annotation's element type. `satisfies` and the argument check report once, at the seed's start. The annotation reports each wrong parser at its own field, which the slices map to the authored entry line. A missing field still lands on the seed line. Accepted beyond the entry: `String(field)` as an exact site. Under the strict profile, a `number`/`boolean`/`Date` attribute is a tsc error without it, and the server serializes the value the same way.
  **Check:** `server/tests/compiler/list-harvest.test.ts` (45 tests, both surfaces). (1) The calctable-shaped `{ id, description, amount, pricePerUnit }` list is rendered by the server from args, adopted untouched in the realm, and `total` is 8.75, `typeof pricePerUnit` is `number`. (2) An imported `DueTask` with a complete `harvest()` map compiles, and the `Date` field round-trips through `asParser(v => new Date(…))`. (3) tsc over the generated modules, remapped like check:corpus: the complete map is clean; a field missing from the map fails at the `harvest(tasks` line; a wrong parser fails at its entry line (imported type, and a same-file type with an overriding entry). (4) LTC072, LTC076 (per field and whole item) and LTC059 per field fire on both surfaces. (5) An aliased import works; a literal seed, a stray `harvest()` and an item-setup `harvest()` seed are refused; an item-setup `const harvest` shadows the marker. Parity: LTC072/LTC076 cases in `tsx/diagnostic-parity.test.ts`. Authored `.tsx`: `fixtures/tsx/harvest-list.tsx` compiles clean, and `harvest-bad-parser.tsx` fails with `TS2322 Parser<string> → Parser<Date>` at 15,4 (pinned in `typecheck.test.ts`). Gates on c4e2a370: test:server 3181 pass / 0 fail, typecheck, check:contract, check:corpus (38 components, 0 warnings), build:docs, check:links (731) green, biome clean on changed paths. The corpus was built before and after: every generated module is byte-identical. form-tokenbox's `string` list keeps the hole path. Not run (sandbox): test:variants, and the Deno leg of check:sim. Doubts: a `harvest()` call in a template expression is not refused by the compiler; tsc catches it in check:corpus as "Cannot find name". The new copy (LTC072/LTC076, three LTC005 faces) is a first draft and should get a `writer` pass. An optional field (`n?: number`) infers its base type, so an absent value comes back as the parser fallback, not `undefined`.
  **Review:** Changes requested ↩ (Architect, 2026-10-05). Accepted as built: field sites over the elements every item carries, `harvestCallOf` shaped for LT-443's overload, the rider through `markerOf(ctx, node, enclosing)`, corpus outputs byte-identical. Deviations accepted: (1) the map callback's return-type annotation instead of `satisfies` — tsc then reports each wrong parser at its own entry; (2) `String(field)` counts as an exact site; (3) LTC076 covers an unreadable item type with no map; (4) `import type` placement sees setup statements. The LTC072/LTC076/LTC005 copy gets the `writer` pass at iteration close.
  1. **An optional field infers its base type's parser — a silent wrong value.** `n?: number` infers `asNumber`, so an item whose server value is `undefined` connects with the parser's fallback (ADR 0003: the harvest must reproduce the server value). An optional property (`?:`) has no inferred parser, the same as a `number | undefined` union already has: it is LTC076 unless a `harvest()` entry declares it. Pin it on both surfaces, plus a declared entry that round-trips `undefined`.
  2. **A `harvest()` call outside the `createList` seed position is refused only in setup.** In a template expression, handler, thunk or `expose()` entry the compiler passes it through and only `check:corpus`'s tsc notices (the import is stripped). The compiler decides marker positions, so it reports the misuse (ADR 0028: statically decidable → an LTC rule, not tsc). Add one sweep after extraction: every reference to a marker binding (via `markerOf`, enclosing scopes included) that no consumer claimed is LTC005 with the existing "outside a `createList` seed" copy, on both surfaces. Write it generically over `MARKER_NAMES`, so a stray `css` and LT-443's scalar form are covered by the same sweep. Pin a template-expression and a handler case for `harvest`, and a stray `css` outside `<style>`.

  **Reworked:** (1) Fixed. An optional field (`?:`) now infers no parser: `resolveListItem` gives it `parser: null` and the type text `T | undefined`, so it is LTC076 unless a `harvest()` entry declares it. To let a declared entry return `undefined`, each map entry is now typed as `FieldParser<T[K]>` (`(value: string | null | undefined) => T[K]`), which any `Parser` of the field's type still satisfies. The authored negative probe's pinned message is now `… not assignable to type 'FieldParser<Date>'`. Pinned on both surfaces in `list-harvest.test.ts`: `note?: string` with no entry is LTC076; `harvest(rows, { note: v => v ?? undefined })` round-trips in the realm as `kept,<undefined>`, with the HTML untouched. (2) Fixed. After lowering, `front-end.ts` runs `reportUnclaimedMarkers` (in `imports.ts`). It walks the component function with the scope-aware `forEachFreeIdentifier` over the import-time marker table, so nested shadowing resolves itself, and reports every reference to a marker binding that no consumer claimed as LTC005. The copy is `diagnostic.misplacedMarker`, one row per `MARKER_NAMES` entry: the existing harvest copy, and a new `css` row. Consumers claim through `claimMarker`: the `.tsx` stylesheet read for `css`, and `harvestCallOf` for every recognized `harvest()` callee. LTC073's refused `<style>` blocks also claim their contents, so a `css` there is reported only as LTC073. The setup-only `readsHarvest` checks are gone in favour of the sweep; the specific item-setup-seed and literal-seed refusals stay. Pinned on both surfaces: `harvest()` in a template expression (reported at the `harvest` identifier) and in a handler, and a stray `css` in a handler. Gates on 7364f9d2: test:server 3191 pass / 0 fail, typecheck, check:contract, check:corpus (38 components, 0 warnings), build:docs, check:links (731) green, biome clean. Corpus outputs are byte-identical to the pre-LT-429 build. Not run (sandbox): test:variants, Deno leg of check:sim.
  **Review (rework):** Approved (Architect, 2026-10-05). (1) An optional field has no inferred parser (LTC076 without an entry); entries are typed `FieldParser<T[K]>` so a declared entry may return `undefined` — ADR 0046 s7 amended to match. (2) `reportUnclaimedMarkers` (`imports.ts`) sweeps every marker reference no consumer claimed (`claimMarker`) as LTC005, generic over `MARKER_NAMES`; an LTC073-refused `<style>` claims its contents so the tag is not reported twice. test:server 3191/0; corpus outputs byte-identical. `test:variants` and the Deno leg of `check:sim` are the owner's (sandbox).

- [x] LT-430: An unparseable `i18n/manifest.json` is read as empty and overwritten by `i18n:sync` (LT-356 review). — reviewed ✓
  **Area:** server
  **Needs:** LT-356
  **Changed:** an `i18n/manifest.json` that exists but does not parse as a JSON object is no
  longer read as empty. `readCatalogs` (`server/effects/i18n.ts`) reports it as
  `Catalogs.unreadableManifest`; the census records one `malformed` gap keyed `manifest.json`
  (locale `*`) and reports no `stale` while it stands. `i18n:sync` reads the manifest through
  `readCatalogs` before compiling, and on an unreadable one exits 1 naming the file and the parse
  error, writing nothing. An absent manifest stays the first-run empty state. Documented in
  `LE_TRUC_COMPILER.md`; regression tests in `server/tests/compiler/i18n.test.ts`.

  **Review:** Approved (Architect, 2026-10-05). Accepted as is: the shared reader maps a missing
  file to an empty catalog (only reachable for a catalog file that vanishes after the listing),
  and sync now drops non-string hashes and non-object locale entries inside a readable manifest
  (they were never usable). The census summary counts the record under `*` (cosmetic). Sync
  has no automated test, because it reads its config from `REPO_ROOT`; acceptance was verified
  by hand.

- [x] LT-431: LTC074 checks server-mode conditional arms in a reconcile container, and `data-key` no longer exempts a sibling (LT-186 review). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-186
  **Changed:** LTC074 (`server/compiler/analysis/loops.ts`) checks every arm root of a
  server-mode conditional in a reconcile container (every arm, nested ones included) and the
  body and catch roots of a `try` without a pending arm. Only `data-unreconciled` exempts a
  sibling now; an authored `data-key` does not. Message, code comment, `VOCABULARY_LEDGER.md`
  and `skills/le-truc/references/errors.md`/`runtime.md` updated. Tests in
  `server/tests/compiler/diagnostic-ranges.test.ts` (both surfaces; nested recursion `.tsrx`
  only, as `.tsx` refuses a nested ternary branch).

  **Review:** Approved (Architect, 2026-10-05). Rulings: (1) extend LTC074 into the arms rather
  than refuse the conditional (owner, 2026-10-05); every arm is checked, because the winner
  depends on render args. (2) `data-key` is no exemption: `reconcile()` removes an unknown key
  and adopts a matching one as that item. (3) A `try` without a pending arm is a server boundary
  and LTC074's; an async boundary stays LTC063's. LTC063's copy for a boundary is LT-432.

- [x] LT-432: LTC063's message names the async boundary when that is the culprit (LT-431 review). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-431
  **Changed:** LTC063 names an async boundary when one fires it: "An async `@try` boundary
  (one with `@pending`)" / "An async `<truc:try>` boundary (one with `pending`)", with "move the
  boundary out". A reactive conditional's message is unchanged. `reactiveConditionInReconcileContainer`
  (`server/compiler/diagnostics.ts`) takes `construct: 'conditional' | 'try'` from `armContainer`;
  `SurfaceWording` gains `asyncBoundary`. The LTC063 lines in `skills/le-truc/references/errors.md`
  and `compiled.md` and in `CHANGELOG.md` updated. Tests: `diagnostic-ranges.test.ts`,
  `tsx/diagnostic-parity.test.ts`.

  **Review:** Approved (Architect, 2026-10-05). The "(one with `@pending`)" clause stays: a
  plain `try` in the same place is LTC074's, so it tells the author which rule fired.

- [x] LT-433: The `index.js` bundle is byte-identical whether built in the main checkout or a task worktree (LT-422 review). — reviewed ✓
  **Area:** server
  **Gates:** build
  **Changed:** `build:prod` runs the new `scripts/build-bundle.ts` (same entry, `--outdir` and
  `--define` flags; any other flag is refused). It builds through `Bun.build` and rewrites only
  the `// ../…` module comments that resolve inside the real `node_modules` back to
  `// node_modules/…`, so a worktree's `index.js` is byte-identical to the main checkout's.
  Where `node_modules` is not a symlink it changes nothing. Bun 1.4.2 has no native fix: neither
  `--preserve-symlinks` nor `preserveSymlinks` keeps the symlinked path. The `scripts/worktree.ts`
  header records that the bundle is location-independent.

  **Review:** Approved (Architect, 2026-10-05). The worktree's `build:prod` output is
  `cmp`-identical to HEAD's committed bundle, and `bun run build` leaves `index.js` clean. No unit
  test: the rewrite only acts under a symlinked `node_modules`, so the `cmp` check is the
  regression check.

- [x] LT-434: Sweep the remaining "ADR 0023" misattributions outside `server/compiler/` (LT-414 residue). — reviewed ✓
  **Area:** server
  **Changed:** every TSRX-sub-design citation that read "ADR 0023" now reads "ADR 0024" — `server/`
  (effects header, `corpus-compile.ts`, `server/tests/compiler/` describe titles and headers),
  `scripts/` (build-corpus, check-corpus, verify-cem), `custom-elements-manifest.config.mjs`, the
  `examples/**/*.tsrx` header comments, and ADR 0039 s4. Comments and test titles only; no snapshot
  or generated artifact changed. ADR 0023 is now cited only for the bind-helper map form
  (`ARCHITECTURE.md`, `CHANGELOG.md`, ADR 0026, `src/bindings.ts`, `types/src/bindings.d.ts`).
  **Review:** Approved. Rescoped by the owner (2026-10-05) to include the examples after the entry's
  "examples are bind-helper citations" premise proved wrong. The one red server test (TS2578 in
  `examples/test/listitem/test-listitem-tsx.tsx`) is LT-425's to clear. `test:variants` did not
  finish in the sandbox (hung past 10 min); the risk is nil for comment-only `.tsrx` edits, because
  `check:corpus` and the compiled goldens are green. Nits fixed by the reviewer: ADR 0039 s4
  citation; `queue/LT-331.md` "ADR 0024 s10".

- [x] LT-435: Typecheck `css-probe.tsx` under the `.tsx` host profile, and glob the examples program so no `.tsx` source falls out of it. — reviewed ✓
  **Area:** examples
  **Changed:** `examples/tsconfig.json` gains `"include": ["**/*.tsx"]` for untwinned `.tsx`;
  twin pairs stay in `files` as both members, because tsc silently drops a wildcard `.tsx` whose
  base name a `.ts` literal already claims (the first ruling, twins alone, lost 13 of 17 and
  still compiled green; caught by the contributor). `host-profile.d.ts` gains `'css-probe'`
  (`CssProbeAttrs = CommonLightDom`, test-fixture tag). `typecheck.test.ts` gains a membership
  test: every `examples/**/*.tsx` on disk must be in the program's `--listFilesOnly` output.
  **Review:** Approved (Architect, 2026-10-05). Gates re-run: typecheck test 4 pass, 18 `.tsx`
  in the program, tsc clean; owner confirmed 0 editor diagnostics on `css-probe.tsx`.

- [x] LT-436: A throw inside a reconcile effect's re-run escapes uncaught (LT-423 finding). — reviewed ✓
  **Area:** runtime
  **Ruling (Architect, 2026-10-05):** a throwing Mount Scope is Contained per scope — ADR 0028 s3's
  per-descriptor granularity one level down; runtime, tier 2; no compiler rule (user code).
  **Changed:** `reconcile()` contains a throwing `bindItem`/`bindArm` per Mount Scope: `mountContained()`
  (`src/helpers/reactive.ts`) wraps `mountScope()`, reports once through `reportEffectFailure` (not
  DEV-gated) as `reconcile() item "<key>"` / `reconcile() arm "<key>"` in the container, and returns a
  no-op cleanup so the element stays in place unbound and is not retried while its key stays. A
  re-entered arm is a fresh scope and reports again. `reportEffectFailure`'s `host` widened to
  `Element`. `reconcile()` JSDoc states the containment and LT-423's insert-before-mount ordering;
  `skills/le-truc/references/errors.md` names the item/arm shape. Pins in `src/tests/reconcile.test.ts`.
  **Review:** Approved. Reviewer nit: dropped the contributor's `CHANGELOG.md` entry — the writer
  records it at iteration close (35cf3094). `index.js` is not rebuilt on this branch: rebuild once
  after LT-412 and LT-436 are both integrated. Playwright to be run by the owner. Follow-up LT-438:
  the reused report copy ("its other effects") reads wrongly for a container.

- [x] LT-438: `reportEffectFailure` copy for a `reconcile()` Mount Scope — "its other effects" names the container (LT-436 review follow-up). — reviewed ✓
  **Area:** runtime
  **Needs:** LT-436
  **Context:** LT-436 reports a throwing list item or arm through `reportEffectFailure`
  (`src/errors.ts`) with the container as `host`. The copy was written for a component: production
  reads ``reconcile() item "a" did not activate in <ul>; its other effects are unaffected:`` and
  DEV reads "…the component's other effects are unaffected." For a Mount Scope the truthful
  statement is that the item (or arm) stays unbound and the list's other items are unaffected. Give
  the scope case its own wording — a `scope` flavour of the reporter or a dedicated
  `reportScopeFailure` beside it, whichever keeps `check:size` flat — following
  `writer` → `references/error-messages.md`. Update `skills/le-truc/references/errors.md` to the
  final string.
  **Channel/tier:** runtime, tier 2 Contained (unchanged; copy only).
  **Rider (LT-355 review):** the `test-listitem` classifications in `server/compiler/sim/classifications.ts` match this string (LT-441) — update them in the same change.
  **Check:** the LT-436 pins assert the new strings in both DEV and production modes; `test:src`,
  `check:size` green.

  **Changed:** a throwing `reconcile()` list item or arm now reports through a dedicated `reportScopeFailure(container, scope, key, error)` in `src/errors.ts`, not `reportEffectFailure`. Production: `reconcile() item "a" did not activate in <ul> and stays unbound; the other items are unaffected:`. DEV: `reconcile() item "a" did not activate in <ul>. The item stays in place but is not bound; the other items are unaffected. Fix the error below, thrown while the item's effects were set up.` Arms read the same, with `arm`/`arms`. Also updated: `skills/le-truc/references/errors.md`, the two `test-listitem` classifications in `server/compiler/sim/classifications.ts` (now exact, `<ul\.tasks>` included, `InvalidPassPropertyError` tail unchanged), and `index.js` plus `types/src/errors.d.ts`, rebuilt.
  **How:** `mountContained` now takes `(container, 'item'|'arm', key, bind)`. The reporter is separate rather than a flavour because a flavour ships the scope copy in every `defineComponent` bundle (+31B minimal), while a dedicated reporter tree-shakes with `reconcile()`. `reportEffectFailure`'s JSDoc no longer claims the scope case. Two new pin tests in `src/tests/reconcile.test.ts` (LT-436 describe) assert the item and arm strings in full in both DEV and production.
  **Check:** `test:src` 516/0, `check:size` minimal 9133B (before 9133B), core-form 9946B (before 9944B), core-checkbox 9961B (before 9960B). `typecheck` green. `build:docs` then `test:server` 3118/0. With the new copy, mangling the classification regex makes the sim tests fail, so the regex is load-bearing. Playwright and `test:variants` were not run: they cannot run in this sandbox. Doubts: (1) "the other arms are unaffected" is true but thin, since only one arm is live at a time. (2) `reportEffectFailure`'s DEV copy still says "failed to activate", which brushes against Tier 2 criterion 3. That is out of scope here; a writer pass could align it. (3) There is no CHANGELOG entry, because LT-436's containment has none either.
  **Review:** Changes requested ↩ (Architect, 2026-10-05). Dedicated `reportScopeFailure` accepted (minimal bundle flat); item copy approved. 1. The arm copy is vacuous: one arm is live at a time, so "the other arms are unaffected" tells the reader nothing. For `scope === 'arm'` say what actually holds: the arm stays unbound until the condition switches, and the next arm mounts afresh (re-entry clones, ADR 0037). Keep the item copy as is; update the arm pins and `errors.md`. Out of scope, for the iteration's `writer` pass: `reportEffectFailure`'s DEV "failed to activate" wording.

  **Reworked:** 1. Fixed: in `reportScopeFailure`, the arm copy now states what holds. Production: `reconcile() arm "then" did not activate in <div> and stays unbound until the condition switches; the next arm mounts afresh:`. DEV: `reconcile() arm "then" did not activate in <div>. The arm stays in place, unbound, until the condition switches; then the next arm mounts afresh. Fix the error below, thrown while the arm's effects were set up.` The item copy is unchanged. Also updated: the arm pins (DEV and production), the JSDoc, `skills/le-truc/references/errors.md`, and the rebuilt `index.js` and `types/src/errors.d.ts`.
  **Check:** `test:src` 516/0. `check:size`: minimal 9133B (flat), core-form 9947B (+1), core-checkbox 9961B (flat). `typecheck` green. `test:server` 3118/0. Playwright and `test:variants` were not run: they cannot run in this sandbox.
  **Review (rework):** Approved (Architect, 2026-10-05). `reportScopeFailure` (`src/errors.ts`) carries the Mount Scope copy; arm copy now states the switch-and-remount outcome. Reviewer nit ec1d9c67: JSDoc rewrap, `errors.d.ts` regenerated. `check:size` minimal 9133B flat, core-form +2B. `test:variants` is the owner's (sandbox).

- [x] LT-439: A module-level `type` declaration in a `.tsrx` source may not reach the generated modules (LT-424 finding) — reproduce, then fix or close. — reviewed ✓
  **Area:** compiler
  **Context:** During LT-424 the contributor's ad-hoc `.tsrx` fixtures declared a module-level
  `type` (an item shape for `createList<Task, …>`) that did not appear in the generated client or
  server module, so the generated code failed to type. Unverified, and it predates LT-424. The corpus
  migrations (LT-109–LT-111) author `.tsrx` members with item types, so a confirmed drop would block
  them silently. Reproduce on a minimal `.tsrx` fixture with a module-level `type` and `interface`
  used by a setup declaration; compare against the `.tsx` spelling of the same component.
  1. **If it reproduces:** carry module-level type declarations (`type`, `interface`, type-only
     imports) into both generated modules on `.tsrx`, the way the `.tsx` front end does; pin it with a
     fixture whose generated modules typecheck under `check:corpus`'s tsc flags, on both surfaces.
  2. **If it does not:** record the fixture that disproves it in the task's `**Changed:**` line and
     close it with no code change.
  **Channel/tier:** compiler — a carry-through fix, no new diagnostic.
  **Check:** the fixture's generated modules typecheck on both surfaces; corpus goldens
  byte-identical; server suite and `check:corpus` green.

  **Changed:** Reproduced — on BOTH surfaces, not just `.tsrx`: a module-level `type`/`interface` without `export` was dropped from the client and server modules (the shared `readModuleDecls` in `assemble-ir.ts` carried only `ExportNamedDeclaration`-wrapped ones), so `createList<Task, …>` / `const n: Note` named undeclared types (TS2304). Exported declarations and `import type` placement already worked on both surfaces.
  **How:** `readModuleDecls` now carries a bare `TSTypeAliasDeclaration`/`TSInterfaceDeclaration` verbatim like an exported one; it flows into `typeDecls`, so the existing type-only-import placement (LT-106) credits names it references. `propsTypeName` still binds only an exported `<Name>Props`. IR doc updated. Fixture: `server/tests/compiler/module-type-decls.test.ts` — the same component with a module-local `type ProbeTask` (list item shape) and `interface ProbeNote` (setup annotation) on `.tsrx` and `.tsx`; asserts both declarations in both modules and runs tsc with `check:corpus`'s flags over all four generated modules (red before the fix with 8 TS2304, green after).
  **Check:** `test:server` 3064 pass / 3 fail (exactly the LT-441 build-report baseline trio); corpus goldens byte-identical (no corpus source has a module-local type); `typecheck`, `check:contract`, `check:corpus` (38 components), `build:docs`, `check:links` (728) green; biome clean on touched paths. Doubt: the entry assumed `.tsx` carried these — it did not, so the fix lives in the shared assembler; a module-local type now also lands in the generated module's text, which is harmless (not exported) but is a generated-output change.
  **Review:** Approved (Architect, 2026-10-05). The drop was surface-independent: the shared `readModuleDecls` carried only exported type declarations, so the fix lives in `assemble-ir.ts` and `.tsx` output gains module-local types too (corpus goldens unchanged, no corpus source declares one). A module-local `<Name>Props` stays unbound as the props type by design.

- [x] LT-440: A compiler-inferred `number` harvest truncates decimals — `parserForType` maps `number` to `asNumber` (LT-429 design session). — reviewed ✓
  **Area:** compiler
  **Context:** `parserForType` (`server/compiler/analysis/harvest.ts:123`) maps an inferred
  `number` signal to `asInteger`, which `Math.trunc`s (`src/parsers/number.ts:39`). A number signal
  harvested from a text or attribute site whose server value is `2.5` connects as `2` — a silent
  miscompile (ADR 0003: the DOM is the truth at load, and the harvest must reproduce it). The server
  renders numbers with `String(n)`, the shortest round-tripping form, so `parseFloat` (`asNumber`)
  recovers every value exactly; `asInteger` adds only hex, which the server never writes.
  Ruling (owner, 2026-10-05): `asInteger` is not a generalizable inference — map `number` →
  `asNumber`. Narrow `ParserKind` (`analysis/plan.ts:47`) to `'asNumber' | 'asBoolean' | 'asString'`
  and drop `asInteger` from the harvest emission path; an authored `asInteger()` (a Parser-exposed
  prop, `evaluability.ts` route 1) is untouched. LT-429 reuses this mapping for list-item fields.
  Channel/tier: none — no new check; this fixes a silent wrong value.
  **Check:** a fixture with a number signal seeded `2.5` from a text site and from an attribute site
  connects at `2.5` on both surfaces; regenerate affected generated-module snapshots and confirm the
  diff is the parser name only. Full compiler gates.

  **Changed:** `parserForType` maps an inferred `number` signal to `asNumber` (was `asInteger`, which `Math.trunc`ed a `2.5` seed to `2` at connect); `ParserKind` narrowed to `'asNumber' | 'asBoolean' | 'asString'`. Authored `asInteger()` (Parser-exposed props, evaluability route 1) untouched. `COMPILER_SPEC.md` §10 example updated.
  **How:** `server/compiler/analysis/harvest.ts` + `analysis/plan.ts`; new regression `server/tests/compiler/number-harvest.test.ts` (text site and `data-n` attribute site, both surfaces, connect in the simulation realm at `2.5`; all 8 fail on the old mapping). Expectations in `client.golden.test.ts`, `raw-value-source.test.ts` updated; snapshots `basic-counter.client.ts.snap` and `tsx/__snapshots__/parity.test.ts.snap` regenerated — diff is the parser name only (import line + seed call, 2 lines each).
  **Check:** `bun test server/tests/compiler/number-harvest.test.ts`. Gates: test:server 3069 pass / 3 fail (exactly the LT-441 build-report baseline trio), typecheck, check:contract, check:corpus, build:docs, check:links, lint:server green. Unrunnable: test:variants (Playwright) — every spec timed out at 30s in the sandbox; basic-counter's served `.tsx` client changes import, so the owner should run it. Doubt: a `<data value>` attribute site harvests via `String(data.value)` and now reads through `asNumber` too (raw-value-source fixture).
  **Review:** Approved (Architect, 2026-10-05). Mapping and `ParserKind` narrowed; every remaining `asInteger` in `server/compiler/` is the authored-Parser path (vocabulary, imports allowlist, route-1 seeds). Snapshot diff is the parser name only (basic-counter client, tsx parity). `test:variants` did not run in the sandbox (Playwright timeouts across unrelated specs); the owner runs it at integration, since basic-counter's served client now imports `asNumber`. The `<data value>` IDL harvest path reaches `asNumber` through the same mapping; no separate pin.

- [x] LT-441: The `test-listitem` simulation classifications predate LT-436's Mount Scope descriptor — `test:server` is red on v3 (LT-355 review finding). — reviewed ✓
  **Area:** compiler
  **Gates:** test:server
  **Context:** LT-436 reports a throwing `reconcile()` item through `reportEffectFailure` with the
  descriptor `reconcile() item "<key>"`, so the realm logs ``reconcile() item "task-1" did not
  activate in <ul.tasks>; …``. The two standing entries for `test-listitem` and `test-listitem-tsx`
  in `server/compiler/sim/classifications.ts` still match `/reconcile\(\) did not activate .*/`. Result
  on v3 (c59013a2): `sim-driver.test.ts` "build-report baseline (LT-163)" fails three tests — the
  `.tsrx` notice is unclassified and the `.tsx` entry matches nothing. The attribution also needs a
  look: the failing run reports only `test-listitem`, not the `.tsx` twin.
  1. Widen both regexes to the LT-436 descriptor (`reconcile\(\) item "[^"]+" did not activate`).
     Do not loosen them past the `InvalidPassPropertyError` clause.
  2. Confirm both twins still report the notice. If the `.tsx` twin no longer does, retire its
     entry (the test demands it) and state why in the handoff.
  **Channel/tier:** none — test classification data only.
  **Check:** `test:server` green, the LT-163 baseline included. LT-438 rewords the same message
  again; it updates these regexes in the same change.

  **Changed:** both `test-listitem`/`test-listitem-tsx` entries in `server/compiler/sim/classifications.ts` now match the LT-436 descriptor (`reconcile\(\) item "[^"]+" did not activate .*InvalidPassPropertyError: …`, tail unchanged); the `.tsx` twin still reports the notice (items `task-1`/`task-2`, twice each, same as the `.tsrx` twin), so its entry stays — `test:server` 3064 pass / 0 fail, LT-163 baseline included.
  **Review:** Approved (Architect, 2026-10-05). Prefix-only widening; the `InvalidPassPropertyError` tail is untouched. Both twins report the notice, so both entries stay; the entry's "only `test-listitem`" observation did not reproduce.

- [x] LT-442: Stand up the `@zeix/le-truc-compiler/macros` subpath and move the `css` tag onto it — compile-time markers are imports, never ambients (ADR 0034 s1). — reviewed ✓
  **Area:** compiler
  **Gates:** check:corpus
  **Context:** Ruling (owner, LT-429 design session, 2026-10-05; ADR 0034 s1, ARCHITECTURE.md →
  *Authoring Surfaces* → Compile-time markers): a call the compiler consumes and never runs is
  imported from `@zeix/le-truc-compiler/macros`, because a `.tsx` source is plain TypeScript and the
  import is the only sign a compiler consumes the call. Today `css` is a global in
  `server/compiler/frontend/tsx/host-profile.d.ts:112`, matched by bare name
  (`frontend/tsx/compiler-tsx.ts:73`). This task builds the subpath with `css` as its first export;
  LT-429 adds `harvest()` to it.
  1. **The module.** `server/compiler/macros.ts` exports `css` with today's signature
     (`(source: TemplateStringsArray, ...substitutions: never[]) => string`) and JSDoc moved from
     the profile. Its body throws `Error('css is a compile-time marker: this module was not compiled
     by @zeix/le-truc-compiler')` — copy per `writer` → error-messages. The package does not exist
     yet (LT-254): resolve the specifier in-repo with a `tsconfig.json` `paths` entry beside
     `@zeix/le-truc`, and in whatever resolution `check:corpus` and the pipeline use for authored
     sources. LT-254 carries the `./macros` export (rider added there).
  2. **Recognition by binding.** The compiler matches a marker by module specifier and imported
     name: `import { css as style }` resolves, and a local `css` that is not the import does not
     match. Put the resolution in shared code both front ends call (`.tsrx` uses no `css` today, but
     `harvest()` arrives on both surfaces).
  3. **Stripping.** The marker import never reaches either generated module; drop the whole
     declaration when every specifier is a marker, otherwise only the marker specifiers.
  4. **Retire the ambient.** Delete `css` from `host-profile.d.ts`; add the import to every corpus
     `.tsx` that uses the tag and to the probe/fixture sources. A missing import is then tsc's
     "Cannot find name 'css'" (channel TypeScript, tier 1 Prevented — no LTC rule: tsc already
     decides it at the authored line). Existing `css`-position rules keep their codes, now keyed on
     the resolved binding.
  5. **Docs.** `server/compiler/HOST_PROFILE.md` and `LE_TRUC_COMPILER.md`: the import replaces the
     ambient in every example; one paragraph on markers (specifier + binding, stripped, throwing
     stub). AGENTS.md's mentions of the `css` tag go through `.agents-proposals/` if they need it.
  **Check:** an aliased import compiles identically; a shadowing local `css` is not treated as the
  marker; generated modules carry no `/macros` import; `check:corpus` and the full compiler gates
  green on every `.tsx`.

  **Changed:** `server/compiler/macros.ts` is the `@zeix/le-truc-compiler/macros` module: a `css` stub with the old signature and JSDoc, which throws when reached uncompiled. The `css` ambient is removed from `host-profile.d.ts`. The compiler recognizes a marker by module specifier and imported name (`parseMarkerImports`/`shadowMarkers`/`markerOf` in `imports.ts`, wired by the shared `runFrontEnd` into `ExtractContext.markers` for both surfaces). An alias resolves. A bare `css`, another module's `css` or a component-scope declaration that shadows the import does not match. `parsePlainImports` strips marker specifiers: a declaration of markers only is dropped whole, and a mixed one keeps its other specifiers. Every corpus `.tsx` that uses the tag, both fixtures, the contract probe and the inline test sources now import it. `paths` entries resolve the specifier in the root, `examples/` and the `.tsx` fixture tsconfigs. HOST_PROFILE.md, LE_TRUC_COMPILER.md and `skills/le-truc/references/compiled.md` are updated.
  **How:** `SurfaceAdapter.stylesheetOf` now takes `ctx`, so the `.tsx` adapter can read the marker bindings. A shadowed name is removed from `ctx.markers` after the setup/output split (args + setup `const`/`function`/`class` declarations). `check:corpus` and the pipeline never resolve the specifier, because the generated modules carry no import of it. Only tsc over authored `.tsx` needs the `paths` entry.
  **Check:** `server/tests/compiler/macros.test.ts` (9 tests) covers the aliased import (identical css/server/client), a bare `css`, a foreign `css`, a shadowing local, alias vs local, a mixed declaration, the `.tsrx` strip without LTC014, and the stub's throw. The corpus was rebuilt before and after: every `*.server.ts`/`*.client.ts`/`*.css` is byte-identical. The only diff is `registry.json`'s authored-source offsets, which shift by the added import line. Gates: test:server 3071 pass / 3 fail, and the 3 failures are exactly the LT-441 baseline. typecheck, check:contract, check:corpus (38 components), build:docs and check:links (729) are green, and biome is clean on the changed paths. test:variants could not run here: Playwright times out at 30s on every test, including the untouched `.ts` surface (sandbox). Doubts: (1) A non-marker tag (shadowed, unimported or foreign) or a `${}` substitution still yields an empty stylesheet silently, which was already true before this change. tsc catches the missing import and the substitution, but not a shadowing local, so a rule may be wanted. (2) The task's "css-position rules keep their codes" had nothing to re-key: no LTC rule keys on the tag. (3) Line expectations in two `diagnostics.test.ts` cases moved by +1 because of the added import line.
  **Review:** Approved (Architect, 2026-10-05). Marker table in `imports.ts` (`parseMarkerImports`/`markerOf`/`shadowMarkers`), stored on `ExtractContext.markers`; stripping in `parsePlainImports` (whole declaration or marker specifiers only); `paths` entries in the root, `examples/` and tsx-fixture tsconfigs; the pipeline and `check:corpus` never resolve the specifier, since generated modules never import it. Corpus server/client/CSS outputs byte-identical; only `registry.json` source offsets moved. No `css`-keyed LTC rule existed to re-key. `test:variants` did not run in the sandbox; the owner runs it at integration. Follow-ups: the silent empty sheet on a non-marker `<style>` tag is LT-444; scope-aware shadowing for `harvest()` rides LT-429.

- [x] LT-444: A `.tsx` `<style>` whose content is not a stylesheet spelling compiles to an empty sheet with no message — refuse it (LT-442 finding). — reviewed ✓
  **Area:** compiler
  **Needs:** LT-442
  **Gates:** check:corpus
  **Context:** `styleElementStylesheet` (`frontend/tsx/compiler-tsx.ts`) returns `null` — read as
  `''` by `stylesheetOf` — when the `<style>` child is a tagged template whose tag does not resolve to
  the `css` marker (a shadowing local, an unimported or foreign `css`, any other tag), or when the
  template carries a `${}` substitution. The component then ships no stylesheet and the build says
  nothing. tsc catches the missing import and the substitution (`never[]`), but not a shadowing local
  or a foreign tag; and the compiler must not lean on tsc for a drop it decides itself.
  1. Every `<style>` child on `.tsx` is one of: the `css` marker's tagged template, a bare template
     literal, or empty. Anything else — another tag, a non-template expression, a substitution — is a
     new LTC code (next free: LTC078), tier 1 Prevented, statically decidable, no runtime half. Copy
     per `writer` → error-messages; name the shadowing case explicitly when the tag's local name is
     `css`.
  2. `.tsrx` spells the sheet as a `<style>` element body; confirm its parser already refuses a
     substitution, and if it does not, the same code covers it (`diagnostic-parity.test.ts`).
  **Channel/tier:** compiler, tier 1 Prevented.
  **Check:** parity cases for a shadowed `css`, a foreign tag and a substitution; corpus emits no new
  diagnostic (`check:corpus` 0 hits); goldens byte-identical.

  **Changed:** New tier 1 compiler rule LTC078: a `<style>` block whose content is not a stylesheet spelling now fails the compile on both surfaces. Before, it compiled to an empty sheet with no message. On `.tsx` four shapes are refused, each with its own copy: another tag, a `css` that is not the marker (unimported, another module's, or shadowed — named explicitly), a `${}` substitution (tagged or bare), and any other content (an expression, JSX text, a second child). The `css` marker template, a bare template literal, an empty block and an empty `{}` container stay accepted, and blank JSX text around the child is now ignored (it used to empty the sheet). Item 2: `.tsrx` has no substitution — `@tsrx/core` parses the body as CSS, so `${x}` in a value fails the parse (LTC008) and inside a string it is literal CSS text. But `.tsrx` `<style>{expr}</style>` was the same silent drop, so LTC078's `content` reason covers it (a parity case).
  **How:** Extends the LT-442 machinery rather than forking it. `SurfaceAdapter.stylesheetOf` now returns `StylesheetRead = string | StyleBlockRefusal` (`template-output.ts`, `diagnostics.ts`). `styleElementStylesheet` (`.tsx`) classifies with `markerOf`, and the `.tsrx` adapter refuses a non-`StyleSheet` child. `resolveTemplateOutput` reads the sheet once (it used to call `stylesheetOf` three times) and reports `diagnostic.unreadableStyleBlock`. The fix-it noun phrase is the new `SurfaceWording.stylesheetForm` (it is in the parity allowlist). Ten test fixtures that relied on the silent drop were fixed: six `{'…'}` string styles became `<style></style>` (same empty sheet), and two `.tsx` builders gained the missing marker import. The `item-setup.test.ts` import is the same one-line edit that is uncommitted in the main checkout. macros.test.ts's four "not the marker" cases now assert LTC078. Docs updated: HOST_PROFILE, LE_TRUC_COMPILER inventory, VOCABULARY_LEDGER, CHANGELOG, skills errors.md and compiled.md. ITERATION.md's code ledger now owes LTC078 as used (LT-444).
  **Check:** `bun test server/tests/compiler/tsx/diagnostic-parity.test.ts`: the parity case "LTC078 an expression in place of the stylesheet" and the `.tsx`-only asymmetry cases (shadowed `css`, another module's `css`, foreign tag, substitution tagged and bare, JSX text, second child, accepted spellings). A shadowed `css`, a foreign tag and a substitution have no `.tsrx` spelling, so they sit under "grammar asymmetry", not in FAMILIES. Gates in the worktree: test:server 3132 pass / 0 fail, typecheck clean, biome check ./server clean, check:contract ✓, check:corpus 0 LTC078 hits and 0 standing warnings, build:docs ✓, check:links 730/730, goldens unchanged (server.golden in the suite). Not touched: no variant set and no `.tsrx` corpus file, so test:variants was not required and not run (it cannot run in this sandbox anyway). Doubts for review: (1) ignoring blank JSX text around the child is a small widening of what is accepted, chosen over refusing a formatter's multi-line layout. (2) A non-marker `css` import from another module also draws LTC014 (unused import) next to LTC078. (3) The `content` reason for a second child is worded "not a stylesheet" even when that child is a valid template.
  **Review:** Approved (Architect, 2026-10-05). Each surface's `stylesheetOf` returns the CSS text or a `StyleBlockRefusal`; the shared hoist in `template-output.ts` reports LTC078 and reads the sheet once (it read it three times before). Fix-it wording goes through `surface.ts` (`stylesheetForm`). Item 2: `.tsrx` cannot carry a substitution (the CSS body parses, `${x}` is LTC008), but `<style>{expr}</style>` was the same silent drop and is now LTC078 on both surfaces. The shadowed/foreign/substitution cases are `.tsx`-only grammar, pinned as single-surface cases. Doubts ruled: blank JSX text around the template is accepted (a formatter's layout, not a new spelling); LTC014 beside LTC078 for a foreign `css` stands, since both are true. The six string-style fixtures that relied on the drop now use an empty `<style>`. `test:variants` is the owner's (sandbox).
