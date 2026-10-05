# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Current iteration (opened 2026-10-02): the corpus port and the pre-publish reshapes.** The
previous iteration (consolidate the compiler, then land the pre-publish reshapes: tracks A–D,
LT-227–LT-406) is landed and reviewed. The `writer` recorded it in `CHANGELOG.md
[Unreleased]` the same day and `DONE.md` was pruned. Its line-count record: `server/compiler/`
measured 75 modules / ~30.4k lines on 2026-10-02 (non-test `.ts`), against the 27.0k baseline of
2026-10-01. The net +3.4k is mostly the scoped-CSS track (`css-scope.ts`, the stylesheet parse)
and the materialized probe; the library swaps retired less than they added.

**Why now (Architect, 2026-10-02).** The first publish sits behind the P6 cleanup round, and P6
sits behind the corpus port (ruled 2026-09-19). The corpus port is three migrations
(LT-109–LT-111) gated on one design, LT-280, which has waited since 2026-09-21. So LT-280 is the
critical path, and it opens as soon as gate zero is green. Around it go the reshapes that must land before the
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
6. **Gate zero: green before anything else** (owner, 2026-10-02). Two gates are red at
   opening. `check:contract` fails because the toy IR literal in `scripts/contract-check.ts`
   predates LT-287/LT-288. `build:docs` fails the simulation gate on module-lazyload's canvas
   notices (NOTES.md, LT-397 session). LT-370 and LT-335 fix them, and they run first and in
   parallel, ahead of the design gates and every other task. Neither waits on a design: LT-370
   leaves everything in `contract.ts` except the IR as it is, and LT-335 already names its
   fallback. If draining the composed closure's work does not land quickly, take the
   origin-tag fallback the task allows rather than hold the iteration. A classification entry
   is not a fix (the baseline test rejects it). Gate zero closes when `typecheck`, the server
   suite, `check:contract`, `check:corpus`, `build:docs` and `check:links` are all green on one
   commit. Record the census and warning baseline on that commit: it is the iteration's opening
   measurement. **Closed 2026-10-02 on b795ff3e** (Architect re-ran every gate on the merge):
   `typecheck` clean; server suite 2830 pass / 5 skip / 0 fail; `check:contract` green;
   `check:corpus` exit 0; `build:docs` and `check:links` (693 links) green. **Opening
   measurement:** tier census 36 entries, 28 Folded / 8 Simulated / 0 Static; compile-warning
   baseline 0; translation census 0 gaps across 6 locales. `check:sim` green on all three
   runtimes (owner, Deno leg outside the sandbox).

**Re-plan (Architect, 2026-10-04).** The process restructuring (LT-418–LT-421: single-agent
roles, task branches committed in the worktree, integration in the review pass) is done, and
so is all of track A: LT-371 and LT-373 are pruned (`queue/LEDGER.md`), and LT-375 and LT-387 are
reviewed. Rulings 1–3 are therefore discharged: every remaining diagnostic producer is born
with `location`, root-is-host is enforced, and the reactivity class is central. LT-378,
LT-393 and LT-410 are pruned too, and LT-391 is reviewed. What is left splits cleanly. About ten mechanical tasks are all
pickable now, and the three migrations plus LT-390 sit behind three design sessions that
have not run. LT-280 has waited since 2026-09-21. The iteration's exit therefore turns on
the owner's calendar, not on contributor throughput. The sessions are scheduled in this order:
7. **Design sessions in critical-path order.** LT-280 with LT-342 first: it gates LT-109–LT-111,
   and its implementation tasks join track C. LT-334 next. LT-276 is pruned, so it is unblocked
   now, and it gates LT-390. LT-409 last: track D is the only thing it gates, and nothing else
   waits on track D.
8. **Corpus-port prerequisites before the correctness track.** LT-374 and LT-186 move ahead of
   track B. When LT-280 rules, the migrations then wait only on LT-280's own implementation
   tasks. Track B still lands in full this iteration, so the reorder only changes what lands first.
9. **LT-415 first.** Every task gate under the worktree flow runs a test server. A stray server
   on 3000 makes `test:variants` refuse and lets Playwright test another checkout's build without
   any error. Fix it before the run of ten.
10. **Acceptance criteria are goals, not constraints to satisfy by workaround** (owner,
    2026-10-04). For the LT-280 implementation chain and the migrations: byte-identical CSS
    across a variant set, the warning baseline 0, unchanged Playwright specs and unchanged
    goldens are the target. A contributor who can meet one only through a workaround that
    bends the design stops, annotates `blocked` and writes the impasse into `NOTES.md`. The
    hand-written twins may carry latent bugs. A spec or golden that encodes one is reported
    with the evidence and ruled by the Architect (fix the twin, or change the expectation);
    it is never matched silently.
11. **LT-280 ruled (2026-10-04) → ADR 0046.** The chain's implementation tasks are LT-422–LT-429.
    LT-425 waits on Cause & Effect 1.6.0 (handoff `CAUSE_EFFECT_LIST_MAP.md`). Without the
    release it is `blocked`, and the track continues past it. LT-355 moves from track B into
    track C after LT-423, which makes its composed child renderable; LT-355 keeps the locale half.

**The chain.**
- **Gate zero — closed 2026-10-02 (b795ff3e).** ~~LT-335~~ (done ✓) and ~~LT-370~~ (reviewed ✓).
- **A — pre-publish reshapes — landed.** ~~LT-371~~, ~~LT-373~~ (pruned), ~~LT-375~~,
  ~~LT-387~~ (reviewed ✓).
- **Design gates** — Area `design`: the Architect with the owner; `start-task` never picks them.
  ~~LT-280~~ + ~~LT-342~~ (ruled 2026-10-04 → ADR 0046). Then: LT-429 (the parser-declaration
  question; gates LT-109 and LT-110), LT-334 (lazyload's boundary; its implementation task pairs
  with LT-390), LT-409 (the shadow-root departures; re-scopes LT-405/LT-407/LT-408).
- **0 — test hygiene** (ruling 9). LT-415.
- **C — corpus port** — every example folder served compiled (ruling 5), through ADR 0046
  (ruling 11). LT-374, LT-186, LT-427, LT-428, LT-422 → LT-423 → LT-425 → LT-424 → LT-355 →
  LT-426 → LT-111 → LT-109, LT-110 (both need LT-429) → LT-390 (needs LT-334). LT-110 is
  LT-165 step 7's corpus pin.
- **B — correctness** — the last iteration's silent miscompiles and drops. ~~LT-378~~,
  ~~LT-391~~ landed. LT-392, LT-356, LT-353, LT-417, LT-430 (LT-356 review follow-up), LT-431 (LT-186 review follow-up), LT-432 (LT-431 review follow-up).
- **D — CSS departures** — re-scoped (or struck) by LT-409 first. LT-405, LT-407, LT-408 (each
  needs LT-409).
- **Parallel slot** — independent work. ~~LT-420, LT-418, LT-419, LT-421~~ (done ✓; the
  restructured flow is in use). LT-305 (the Baseline 2023 guard, ships in 3.0), LT-277
  (server).

**Deliberately not here.** LT-254, LT-257's build half, LT-259–LT-261 stay behind P6 (ruled
2026-09-19), and with them the D-32 (public entry points) and D-28 (`Try` in template targets)
design sessions. LT-381 changes the census and the warning baseline by design and needs the
owner's sign-off first. LT-246 waits for LT-109–LT-111 to settle the census. LT-363, LT-369,
LT-372 (after LT-371, post-publish-safe) and the P3/P4/P6 items stay in the backlog. LT-310 and
LT-311 are design work and wait for P6.

**Exit criterion.** Tier census and warning baseline unchanged from the iteration's opening
measurement (recorded on the gate-zero commit, ruling 6), except where LT-109–LT-111, LT-390 or an
LT-280/LT-409 ruling change them by design, as those tasks state; the warning baseline stays 0.
The mechanical tasks (LT-370, LT-371, LT-373, LT-375's migration half, LT-393) leave goldens
and parity byte-identical. Every example folder is served compiled, per ruling 5. ADRs record
LT-280's (ADR 0046) and LT-409's rulings. The IR is out of `contract.ts`, every diagnostic carries
`location` on both surfaces, and a fragment root fails LTC060. No silent miscompile from the
last iteration's reviews remains open (LT-378, LT-387, LT-355, LT-391). `check:contract`,
`bun run build:docs` and `check:links` pass. The net line count of `server/compiler/` is
recorded against the 30.4k opening measurement.

**Next free task ID: LT-433.** Next free diagnostic code: LTC075 (LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is LT-399's; LTC070 is LT-304's; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Gate zero (closed 2026-10-02, b795ff3e)

<!-- entries -->

### Design gates

- [ ] LT-429: Per-field harvest for list items seeded from server args; LTC072 for an item field with no harvest site (ADR 0046 s7). **Design first: how a field declares its parser.**
  **Area:** design
  **Needs:** LT-423
  **Context:** The `list` harvest (`emit-client.ts:163-179` `listDeclaration`) rebuilds each
  adopted item from one slot's `textContent`, which works for string items only. ADR 0046 s7:
  harvest each field from its canonical render site inside the adopted item (a direct text child,
  or an attribute/property whose arrow reads exactly the field, unformatted; first in document
  order; a field `keyConfig` returns verbatim comes from `data-key`). A formatted-only site needs
  a raw source (LT-374's LTC059 per field). A field with no site is **LTC072** (compiler,
  tier 1 Prevented), naming the fix: render it (`data-<field>` on the item root, or
  `<data value>`). Only lists seeded from server args are in scope.
  **Design question (owner, 2026-10-04) — rule before this task is pickable:** how each field
  declares its parser. Syntactic inference from a same-file item type (`parserForType`,
  `analysis/harvest.ts:122-131`) was judged fragile. Weigh explicit declaration (e.g. a parser
  map beside the `createList` call, or a per-site annotation) against inference. Also verify
  whether `parserForType`'s `number → asInteger` truncates decimals for top-level props today;
  list fields need `asNumber` (module-calctable's `pricePerUnit`). When ruled, the Architect
  rewrites this entry as `area: compiler`.
  **Check (after ruling):** a calctable-shaped fixture round-trips a seeded `{ id, description,
  amount, pricePerUnit }` item set on both surfaces; an unrendered field fails LTC072 on both;
  copy follows `writer` → error-messages. Full gates.

- [ ] LT-334: An async boundary lazyload can be spelled in (LT-104 review). **Gated by LT-276 (ADR 0037's template-cloned arms).**
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


- [ ] LT-409: Design session — the departures of compiled CSS from a real shadow root (ADR 0033 s7 as a whole; re-scopes LT-405, LT-407, LT-408).
  **Area:** design
  **Context:** The owner's ruling and the facts the session starts from, moved from the
  BACKLOG.md P2b preamble:
  **[2026-10-02, owner: LT-405 rolled back; LT-407 and LT-408 deferred from the current iteration's track D.]** All three explain or police a way compiled CSS departs from a real shadow root. The owner wants those departures re-evaluated in a design session (architect) before more of them are documented or given diagnostics: "the differences to real Shadow DOM become a burden that is increasingly hard to explain." The session reviews ADR 0033 s7's list as a whole (zero-specificity `:host(…)`, template-authored content inside a composed child, the LTC070/LTC071 refusals) and decides, for each, whether to keep it, close the gap in the emission, or reshape it. Re-scope all three from the session's outcome before picking any up.

  **Known state after the rollback (2026-10-02, measured by a contributor).** These are the input facts for the session.
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


### C — corpus port

- [ ] LT-422: The Value Harness follows the signal meaning — lists iterate cells, store fields are cells; `createSensor` is a signal constructor (ADR 0046 s3, s5).
  **Area:** compiler
  **Context:** ADR 0046 s3 makes a reactive-list item the signal the List hands out, on both
  phases. The harness (`server/compiler/runtime.ts:55-96`) iterates **values** today, and its
  `createStore` is a plain box, so `item.label.get()` cannot run at render time. Make it follow
  Cause & Effect exactly:
  1. `ServerList` iterates cells. It gains `map((cell, key) => R): R[]`, `forEach`, `keys()`
     and `byKey()`, keyed exactly as today (`getKeyGenerator` parity). `entries()` stays
     internal to the emitted server loop and yields `[key, cell]`.
  2. `createStore(initial)` returns an object whose fields are cells, plus `get()` returning
     the whole value. Nested objects are stores and arrays are lists, as in C&E's `MutableStore`.
  3. `deriveList` returns the same cell-iterating list.
  4. `createSensor(start, { value })` joins `SIGNAL_CONSTRUCTOR_NAMES` (`vocabulary.ts`). The
     harness boxes the `value` seed, which is its server value. Without a seed, a read is
     Unresolvable, through the existing fold-refusal routing (ADR 0029 s5).
  5. The emitted server loop and the bare `{item}` fill read the cell (`item.get()`), so rendered
     HTML is unchanged.
  **Channel/tier:** none — server mechanism.
  **Check:** rendered HTML goldens and parity byte-identical (server-module goldens change by
  design; state which). Harness unit tests pin store fields, `map`/`byKey` key parity with C&E
  for the string-prefix, function and positional `keyConfig` forms, and a seeded/unseeded
  `createSensor` read. Full gates, `check:sim`.

- [ ] LT-423: A reactive-list item is a Mount Scope — item content lowers through the arm emission (ADR 0046 s1–s3).
  **Area:** compiler
  **Needs:** LT-422
  **Gates:** check:sim
  **Context:** Today `bindItem` gets a bare-`{item}` text fill plus events (`ReconcilePlan`,
  `analysis/plan.ts:179-216`; `emitReconcileBlock`, `emit-client.ts:281-318`), and
  `validateListBody` (`lower-shared.ts:898-986`) refuses everything else under LTC005. The arm
  path already emits full effects per cloned root (`handleReactiveConditional`,
  `analysis/effects.ts`; `ArmPlan` locals at `emit-client.ts:698-722`). This task lowers **one
  level** of item content through that emission. Nesting is LT-424.
  1. **Item as Mount Scope.** Reactive attributes, class/style maps, `truc:pass` on custom
     elements and composed children, events, and key-derived attributes (set once at clone,
     because a key never changes) all emit into `bindItem` against the item's `first`. Item
     reads follow the signal meaning: arrows over `item.get()`, store fields `item.f.get()`;
     `.tsrx`'s bare `{item}` is the signal shorthand. Handlers may read the item; the LTC005
     "handler reads item" refusal and `listItemHandlerFix` retire on `.tsrx`.
  2. **Template.** The server bakes item-dependent sites **empty** in the `<template>` (ADR 0037
     s1's losing-arm rule) and server-known content as today. Stamp it `data-list="N"`
     (compile-time document-order index per component), place it outside the container, and
     query it as `<parent>.querySelector(':scope > template[data-list="N"]')`. This lifts the
     one-list-per-component limit (`analysis/loops.ts:333-337`).
  3. **Composed children** in the item render into the template; LT-355 owns their `lang`/`i18n`.
  4. **Retire** `validateListBody`'s slot-fill restrictions, except where ADR 0046 s1 still
     refuses: the item's single root, and a host-level `first()` into an item.
  **Channel/tier:** compiler. Retired LTC005 arms change that code's meaning (ADR 0028 lifecycle;
  copy follows `writer` → error-messages). Parity cases on both surfaces for every retired and
  remaining refusal (`diagnostic-parity.test.ts`).
  **Check:** module-list and form-tokenbox goldens: rendered HTML byte-identical except the
  `data-list` stamp (state it). New fixtures on both surfaces: a store item with a reactive
  attribute, `truc:pass` `{get,set}`, a key-derived `id`/`for` and a composed child, adopted and
  then cloned, with wiring surviving adoption (no re-clone at connect). Full gates.
  **Impasse rule (iteration ruling 10):** stop and report rather than work around.

- [ ] LT-425: The `.tsx` keyed `map` — `items.map((item, k) => …)` over `createList`/`deriveList`, Cause & Effect 1.6, a module-list `.tsx` variant (ADR 0046 s4; closes LT-342).
  **Area:** compiler
  **Needs:** LT-423
  **Context:** Cause & Effect 1.6.0 adds `map((item, key) => R): R[]` and `forEach` to both list
  kinds (handoff: `CAUSE_EFFECT_LIST_MAP.md`; delete that file in this task once 1.6.0 is
  consumed). **Precondition:** `@zeix/cause-effect` ≥ 1.6.0 is published. If it is not, annotate
  `blocked` with a NOTES entry and stop.
  1. Bump the dependency; regenerate `types/`.
  2. `lowerFor` (`frontend/tsx/lower-tsx.ts:417-466`) binds the callback's second parameter as
     the key when the receiver is a declared list source. It no longer hard-codes `key: null`,
     and the "index binding" refusal over a List (`lower-shared.ts:1001-1013`) retires on
     `.tsx`. Over an Array the second parameter stays the index.
  3. "Declared list source" widens from `createList` to `createList` + `deriveList`
     (`deriveList` today is LTC001 "File skipped", `lower-shared.ts:1124-1133`).
  4. `surface.ts`: `loopBindings` reads "A loop variable or key binding" on `.tsx`;
     `listItemHandlerFix` gains its `.tsx` text (`items.remove(k)`). The LT-221 grammar-asymmetry
     block in `diagnostic-parity.test.ts:1437-1457` loses its `keyName` arm; the parity case
     pins the reserved-name check on both surfaces.
  5. Add `examples/module/list/module-list.tsx` beside the `.tsrx` (ADR 0039 variant set),
     with `{() => item.get()}` and `items.remove(k)`. It becomes the served surface.
  **Channel/tier:** compiler (tier 1) and TypeScript (the `map` typing).
  **Check:** the module-list variant set's CSS is byte-identical and render parity holds;
  `module-list.spec.ts` (if any) or `test:variants` pass for both surfaces; full gates.
  **Impasse rule (iteration ruling 10).**

- [ ] LT-424: Mount Scopes nest — arms and lists inside arms and items, scoped server-data loops, the cross-scope uniqueness proof (ADR 0046 s1–s2).
  **Area:** compiler
  **Needs:** LT-423
  **Gates:** check:sim
  **Context:** LT-423 makes an item one Mount Scope. This task makes emission recursive:
  every construct emits into its nearest enclosing scope (host, arm, item).
  1. **Lift the refusals** `unmountableInArm` and `validateArmSetPlacement`
     (`analysis/effects.ts:1501-1660`) for arm sets and lists inside arms and items. What stays:
     composed content and server-data loop bodies (ADR 0037 s5 as amended), and LTC063.
  2. **Proof across scopes.** A selector bound in a scope must match nothing in any nested
     scope's possible content (every arm of a nested set, each nested item shape) on the
     materialized probe (ADR 0045). When classes, roles and `data-*` do not separate the
     elements, synthesize a `:scope >` child path. Failure stays LTC007, and its fix names a
     unique class.
  3. **Server-data loops inside a scope** lower to a static query against the scope's root,
     with no `all()`/MutationObserver. The host-level `each(all())` is unchanged.
  4. **Nested templates** ride inside the outer template's content (one copy per outer item);
     no hoisting.
  5. **The `@empty` arm is a scope:** its reactive attributes emit like any other scope's
     (module-ticker's placeholder height).
  **Channel/tier:** compiler; parity cases on both surfaces for each lifted and remaining refusal.
  **Check:** fixtures on both surfaces: a list in an arm, an arm in an item, a list in an item
  (adopted, then cloned at both levels), a selector that would match into a nested item (proved
  or synthesized), and an `@empty` arm with a reactive style. Corpus goldens byte-identical.
  Full gates. **Impasse rule (iteration ruling 10).**

- [ ] LT-355: A composed child inside a reactive-list template is silently dropped — render it, with its root `lang` and `i18n` (LT-351 ruling, ADR 0030 s9).
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


- [ ] LT-426: Per-item setup — the `map` block body and `@for` statements classified by the setup rules; selectors may name the scope root (ADR 0046 s2, s5).
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

- [ ] LT-111: Migrate `module-todo` to `.tsx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-427, LT-428
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe. Must show: store items from an empty seed, per-item `truc:pass` `{get,set}` into `form-checkbox` and the composed `FormInplaceEdit`, key-derived `id`/`for`, a reactive `disabled` from `items.length`, and remove through the key. Drag, keyboard reorder and the live region live in **one shared client-only helper module** called from every surface's setup (LT-427), replacing the module-level `idCounter` and the `let`s. Both `.tsx` and `.tsrx` members. The sweep check is ruling 5's, not "no `.ts` files remain".
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.


- [ ] LT-109: Migrate `module-calctable` to `.tsx` with same-commit cutover.
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-428, LT-429
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe for the reactive-list design. Must show: a list seeded from server args with per-field harvest (LT-429), handlers that write fields (`item.amount.set`), remove-on-zero through the key, a per-row derived price formatted from a raw source, and the trailing `data-unreconciled` entry row (LT-186). Both `.tsx` and `.tsrx` members; the `.ts` twin stays as a variant (ruling 5).
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.


- [ ] LT-110: Migrate `module-ticker` to `.tsx` with same-commit cutover.
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-428, LT-429
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe. Shape ruled at the LT-280 session: an outer reactive list over `<tbody>` blocks, each with a per-item `createSensor` on the scope root (`first('tbody')`, `{ value: true }`), a per-block `height` state written from `IntersectionObserverEntry.boundingClientRect.height` before `visible` flips (one `batch`), and an inner list over a scope-declared `deriveList` that is empty while invisible; the placeholder is the inner loop's empty arm with a reactive height. Rows look up `tickers.byKey(s)` in per-item setup. Formatted cells need raw sources; `open` needs a site (`data-open` or `<data value>`; corpus choice). Both `.tsx` and `.tsrx` members.
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.


- [ ] LT-390: A corpus consumer for reactive conditions and the boundary, with audit coverage.
  **Area:** examples
  **Needs:** LT-375, LT-334, LT-385
  **Context:** LT-274/LT-276 landed with no corpus component using either, so their golden
  and equivalence-audit acceptance items pass vacuously; adoption's designed connect diff is
  pinned only by `reactive-conditions.test.ts`. Migrate one example that wants a reactive
  `@if` (a disclosure or a tab-like switch) and pair the boundary with LT-334 (lazyload),
  extend `equivalence-audit.test.ts` to the arm-adoption class.
  **Depends on** LT-385.


- [ ] LT-110: Migrate `module-ticker` to `.tsx` with same-commit cutover.
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-428, LT-429
  **Updated (Architect, 2026-10-04, ADR 0046):** an acceptance probe. Shape ruled at the LT-280 session: an outer reactive list over `<tbody>` blocks, each with a per-item `createSensor` on the scope root (`first('tbody')`, `{ value: true }`), a per-block `height` state written from `IntersectionObserverEntry.boundingClientRect.height` before `visible` flips (one `batch`), and an inner list over a scope-declared `deriveList` that is empty while invisible; the placeholder is the inner loop's empty arm with a reactive height. Rows look up `tickers.byKey(s)` in per-item setup. Formatted cells need raw sources; `open` needs a site (`data-open` or `<data value>`; corpus choice). Both `.tsx` and `.tsrx` members.
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.


### B — correctness

- [ ] LT-432: LTC063's message names the async boundary when that is the culprit (LT-431 review).
  **Area:** compiler
  **Needs:** LT-431
  **Context:** LTC063 (LT-274) refuses an arm set in a reactive list's container. An async
  boundary (`@try` with `@pending`, `<truc:try pending={…}>`) is an arm set too (ADR 0037 s4)
  and hits the same rule, but the message names only "`@if` or `@switch`" / "A conditional or
  `switch`". Found by the LT-431 session. Make the message name the construct that fired. The
  producer (`reactiveConditionInReconcileContainer`, `server/compiler/diagnostics.ts`) takes only
  `wording`; give it the arm set's construct (`conditional` vs `try`, from the node at the call
  site) and add a boundary spelling per surface to `SurfaceWording` (`@try` / `<truc:try>`), so a
  boundary's message names it and a conditional's stays as it is. Keep the code and the
  tier as they are. Update `skills/le-truc/references/errors.md`'s LTC063 row to say "a reactive
  condition or async boundary". **Channel/tier:** compiler, tier 1 Prevented, unchanged; copy
  and one producer parameter. **Copy:** follows `writer` → error-messages. **Check:** LT-431's async-boundary pin in
  `diagnostic-ranges.test.ts` asserts the new wording on both surfaces; `test:server` green.

### D — CSS departures

- [ ] LT-409: Design session — the departures of compiled CSS from a real shadow root (ADR 0033 s7 as a whole; re-scopes LT-405, LT-407, LT-408).
  **Area:** design
  **Context:** The owner's ruling and the facts the session starts from, moved from the
  BACKLOG.md P2b preamble:
  **[2026-10-02, owner: LT-405 rolled back; LT-407 and LT-408 deferred from the current iteration's track D.]** All three explain or police a way compiled CSS departs from a real shadow root. The owner wants those departures re-evaluated in a design session (architect) before more of them are documented or given diagnostics: "the differences to real Shadow DOM become a burden that is increasingly hard to explain." The session reviews ADR 0033 s7's list as a whole (zero-specificity `:host(…)`, template-authored content inside a composed child, the LTC070/LTC071 refusals) and decides, for each, whether to keep it, close the gap in the emission, or reshape it. Re-scope all three from the session's outcome before picking any up.

  **Known state after the rollback (2026-10-02, measured by a contributor).** These are the input facts for the session.
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


- [ ] LT-405: A nested qualifier on `:host` evades LTC070 (LT-398 residue). — rolled back 2026-10-02, deferred to the design session
  **Area:** compiler
  **Needs:** LT-409
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
  **Area:** compiler
  **Needs:** LT-409
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
  Copy follows `writer` → error-messages, including the `skills/le-truc/references/errors.md` row.
  **Verification:** a `css-scope.test.ts` case asserts the nested flag. A diagnostic test asserts
  each face's message (the nested one has no in-place `:host(…)` fix-it). `tsc` 0, server suite
  green.


- [ ] LT-408: Document the zero-specificity `:host(…)` arguments as an s7 difference (owner ruling 2026-10-02, LT-405 NOTES question).
  **Area:** docs
  **Needs:** LT-409
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

