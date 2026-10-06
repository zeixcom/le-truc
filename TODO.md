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
    LT-425 waited on Cause & Effect 1.6.0 (handoff `CAUSE_EFFECT_LIST_MAP.md`); 1.6.0 shipped and
    the dependency moved to `^1.6.0` on 2026-10-05, so LT-425 is open again. LT-355 moves from track B into
    track C after LT-423, which makes its composed child renderable; LT-355 keeps the locale half.

**Next batch (Architect, 2026-10-05).** LT-423, LT-425 and LT-434 are reviewed and integrated
(460fd94e and the merges before it), and so is every task in tracks 0, A and B except LT-412.
Track C's critical path is now LT-424 → LT-355 → LT-426, all on the compiler's list and arm
emission, so they run one at a time. Two runtime tasks run beside them in `src/`: LT-412 (the
Cause & Effect 1.6.1 bump, unblocked by LT-425) and LT-436. LT-429's design is unblocked
(LT-423 landed) and is the owner's next session: LT-109 and LT-110 wait on it and on LT-426,
so ruling it while LT-424–LT-426 land keeps the migrations off the critical path.
12. **LT-436 ruled: a throwing Mount Scope is Contained per scope** (ADR 0028 s3 extended one
    level down; runtime, tier 2). `reconcile()` reports it once through `reportEffectFailure`,
    leaves the element in place unbound, and continues. The task entry carries the detail.
13. **The landed tasks are not pruned yet.** Pruning waits for the `writer`'s changelog pass
    at iteration close (hard rule); the reviewed entries stay in `DONE.md` until then.
14. **LT-429 ruled (owner, 2026-10-05).** List-item field parsers are inferred from a same-file
    item type and declared otherwise with `harvest(items, { field: parser })` (ADR 0046 s7). A
    compile-time marker is an import from `@zeix/le-truc-compiler/macros`, never an ambient
    (ADR 0034 s1): LT-442 builds the subpath and moves `css` onto it. `asInteger` is not an
    inferable parser: LT-440 maps `number` → `asNumber`. An unresolvable scalar seed type is
    refused unless `harvest(value, parser)` declares it: LT-443 (S3).
15. **LT-334 ruled (owner + Architect, 2026-10-06).** The boundary migration is LT-449
    (pickable now): per-arm duplicated callout with `.danger` authored per arm (the
    arms-span-parents machinery extension rejected), the ok arm a reactive `truc:html`
    thunk, stale dimming as the `isPending` idiom, and the scroll side effect as a
    beside-watch — a sanctioned escape hatch — with a required ordering probe. The
    `allow-scripts` question is decoupled to LT-448 (design): the goal is partials bringing
    *new* components to the page, build-unknown, same-origin or CSP-approved origins, with
    code-splitting required. The decoupling is one-directional — nothing in the lazyload
    track waits on LT-448: LT-449 is pickable now and complete on its own terms, and
    LT-448's session writes the follow-up that revives `shake-hands` (inert → alive per the
    ruled design), absorbing the three re-scoped script-execution spec legs and
    `mocks/module-with-type.html`. LT-390 is re-pointed at LT-449.
16. **LT-110 unblocked (owner + Architect, 2026-10-06).** The blocked session found two
    compiler gaps in the ticker's ruled shape. (a) **List templates hoist to the host's end**
    (ADR 0046 s2 amended → LT-454): one copy per instance, queried from the host, so a
    container may be a scope root (`<tbody>`). Arm templates stay beside their arm, because
    the arm form anchors on them. Comment anchors were rejected for minifier robustness, and
    computed positions for fragility. (b) **A list reached only through `byKey` harvests
    from its alias sites, witnessed by the render** (ADR 0047 → LT-453). Rejected: a JSON
    root-attribute seed (the data ships twice) and a client-side-rendering escape hatch (it
    contradicts enhance-not-generate). Too-large datasets go to LT-450 (design, P7: HTML
    partials on demand). Found on the way: LT-451 (silent miscompiles of a signal
    initializer over a Parser-backed host prop) and LT-452 (the canceller globals). The
    ticker's "LT-165 step 7 corpus pin" clause is withdrawn: `Math.random()` reaches no
    rendered site there, so the pin stays synthetic in `suppression.test.ts`.

**The chain.**
- **Gate zero — closed 2026-10-02 (b795ff3e).** ~~LT-335~~ (done ✓) and ~~LT-370~~ (reviewed ✓).
- **A — pre-publish reshapes — landed.** ~~LT-371~~, ~~LT-373~~ (pruned), ~~LT-375~~,
  ~~LT-387~~ (reviewed ✓).
- **Design gates** — Area `design`: the Architect with the owner; `start-task` never picks them.
  ~~LT-280~~ + ~~LT-342~~ (ruled 2026-10-04 → ADR 0046). ~~LT-429~~ (ruled 2026-10-05 → ADR 0046
  s7, ADR 0034 s1; ruling 14). ~~LT-334~~ (ruled 2026-10-06 → LT-449; `allow-scripts`
  decoupled to LT-448; ruling 15). **Next owner sessions:** LT-448 (partials that bring new
  components; its session writes the shake-hands revival follow-up — the lazyload track
  does not wait on it), LT-409 (the shadow-root departures; re-scopes LT-405/LT-407/LT-408).
- **0 — test hygiene** (ruling 9). ~~LT-415~~ (reviewed ✓). ~~LT-441~~ (reviewed ✓).
- **C — corpus port** — every example folder served compiled (ruling 5), through ADR 0046
  (ruling 11). ~~LT-374, LT-186, LT-427, LT-428, LT-422 → LT-423 → LT-425~~ (reviewed ✓) →
  ~~LT-424~~ (reviewed ✓) → ~~LT-355~~ (reviewed ✓) → ~~LT-426~~ (reviewed ✓) → ~~LT-429~~ (reviewed ✓) → ~~LT-111~~ (reviewed ✓, integrated 2026-10-05) → ~~LT-109~~ (reviewed ✓) → ~~LT-449~~ (reviewed ✓) → **next, critical path (compiler list emission, one at a time):** ~~LT-454~~ (reviewed ✓) → ~~LT-453~~ (reviewed ✓) → ~~LT-110~~ (done ✓) → LT-446 (section-menu, design — the sweep's last folder). **Beside it (example folders only, pickable now):** ~~LT-445~~ (reviewed ✓), ~~LT-390~~ (done ✓).
- **B — correctness** — the last iteration's silent miscompiles and drops. ~~LT-378~~,
  ~~LT-391~~ landed. ~~LT-392, LT-356, LT-353, LT-417, LT-430, LT-431, LT-432~~ (reviewed ✓). ~~LT-412~~ (reviewed ✓). ~~LT-439~~ (reviewed ✓). ~~LT-440~~ (reviewed ✓). ~~LT-442~~ (reviewed ✓). ~~LT-444~~ (reviewed ✓). ~~LT-443~~ (reviewed ✓). ~~LT-452~~ (done ✓). ~~LT-451~~ (reviewed ✓). ~~LT-447~~ (reviewed ✓ — the shape is supported and the declaration already rides both modules; the filed failure was a stale generated module, ruling on the task file; no LTC079). ~~LT-455~~ (reviewed ✓ — a nested list in a server branch of an item now mounts under a guard on its container; the construct residue ruled refuse-not-guard). **Next:** LT-468 (refuse a client construct in a server-rendered branch of an item, filed from LT-455's review — the item walk was the only scope that both descended and emitted there).
- **D — CSS departures** — re-scoped (or struck) by LT-409 first. LT-405, LT-407, LT-408 (each
  needs LT-409).
- **Parallel slot** — independent work. ~~LT-420, LT-418, LT-419, LT-421, LT-305, LT-277,
  LT-433~~ (done ✓). ~~LT-411~~ (reviewed ✓), ~~LT-416~~ (reviewed ✓), ~~LT-414~~
  (reviewed ✓), ~~LT-187, LT-434, LT-435~~ (reviewed ✓). ~~LT-436~~ (reviewed ✓). ~~LT-438~~ (reviewed ✓).

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

**Next free task ID: LT-468.** Next free diagnostic code: LTC082 (LTC081 is reserved for LT-461; LTC080 is LT-453's; LTC079 is LT-447's, unused — its shape is supported, not refused; LTC078 is LT-444's, used; LTC077 is LT-443's; LTC076 is LT-429's, used; LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's, used; LTC071 is LT-399's; LTC070 is LT-304's; LTC066–LTC069 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are LT-274's; LTC061 is LT-383's; LTC056 is LT-358's; LTC057/LTC058 are LT-257's; LTC059 is LT-374's; LTC060 is LT-375's).

---

### Gate zero (closed 2026-10-02, b795ff3e)

<!-- entries -->

### Design gates

- [ ] LT-448: Design session — fetched partials that bring new components to the page (script admission and loading; the compiled `allow-scripts` gap; LT-334 residue).
  **Area:** design
  **Area:** design
  **Goal (owner, 2026-10-06):** allow a fetched HTML partial to bring *new* components to the
  page — components the build did not know. The origin constraint: partials come from the
  same origin, or from origins the page's CSP policy approves. Decouple-point: split out of
  LT-334 so the boundary migration (LT-449) does not wait on a security design.
  **Constraint the ruling must satisfy:** code-splitting for components. A rarely-used, huge
  component (a video player) must not be pulled into the main JS bundle; whatever mechanism
  rules must load component code lazily, on the partial's arrival.
  **Ground truth established in the 2026-10-06 dive** (verify before ruling; facts may have moved):
  1. The platform's free mechanism: `customElements` upgrades any matching element inserted
     into the document — a partial carrying *known* component markup needs no script at all.
     The script in `examples/module/lazyload/mocks/snippet.html` exists only because
     `shake-hands` is not yet *registered* (a guarded `customElements.define` shim).
  2. The runtime escape hatch (`dangerouslyBindInnerHTML({ allowScripts })`,
     `src/bindings.ts`) re-creates script nodes naively: `SCRIPT_ATTRS` copied, inline text
     re-created verbatim, appended after the content, **no dedup and no cleanup — every `ok`
     update re-executes every script** (snippet's define-guard is what keeps the demo correct).
  3. Sanitizer and `allowScripts` are mutually exclusive in the runtime: sanitization runs
     first, so a configured sanitizer (DOMPurify) strips `<script>` before the re-creation
     pass sees it; the escape hatch works only raw-passthrough. The compiled `truc:html`
     path always passes `sanitizeHtml` (fail-closed, ADR 0010), so scripts never survive it.
  4. `allowScripts` has exactly one consumer in the repo: `module-lazyload`. The demo page
     authors `allow-scripts`; `mocks/module-with-type.html` is a pure script-execution fixture.
  **Options discussed (no direction picked — rule, then record):**
  - **A. Registry pattern.** Behavior in partials = custom elements; the page pre-registers
    the tags its partials use; no script execution, no new mechanism. Fails the stated goal
    for genuinely build-unknown components and strains the code-splitting constraint
    (pre-registration means main-bundle weight).
  - **A′. Lazy registry.** A tag→chunk manifest; after a partial inserts markup, a loader
    fetches the unknown tags' component chunks and registers them — code-splitting native.
    Tension: the manifest is build-known; a partial bringing an unknown component needs a way
    to *declare* its components (a manifest beside the partial, fetched with it?) — that
    softening is part of the question, not settled.
  - **B. Policy-driven client loader.** The authored `allow-scripts` opt-in teaches the
    compiled `truc:html` a script policy running *inside* the sanitize step (mends finding 3):
    external-`src` re-created deduped by src, `type="application/json"` passthrough,
    `type="importmap"` refused, inline per policy. CSP cost: re-created inline scripts need
    `unsafe-inline` or a render-injected nonce.
  - **C. Arm-lifecycle execution semantics.** Orthogonal to B (foldable into its policy):
    scripts execute as arm effects — run on arm adoption, cleanup on arm exit, no
    re-execution on re-render. The compiler knows the arm boundary; the runtime never could.
  - **D. Build/serve-time extraction.** For same-origin partials the build can see, the
    server strips scripts and ships them as proper external, hashed module URLs; the client
    loads them as ordinary deferred scripts (CSP-clean, no `unsafe-inline`, browser-managed
    order and dedup). Genuinely dynamic URLs fall back to B/C.
  **Trust framing to carry:** no mechanism makes an untrusted script safe; sandboxing
  untrusted code is origin isolation (iframes), a different product. `allow-scripts` stays a
  page-author trust grant at the component boundary, origin-constrained per the goal. What a
  full-stack design adds over the runtime is hygiene and defaults, not safety.
  **Held state:** `shake-hands` stays broken until this rules (owner, 2026-10-06) — the
  lazyload demo shows it inert; do not paper over it with pre-registration (that is option A,
  and it strains the code-splitting constraint). `mocks/module-with-type.html` and the three
  script-execution spec legs (LT-449 re-scoped them here) are this session's test input.
  **Exit:** rule the direction (an option, a combination, or a new one); decide whether it
  needs an ADR (ADR 0047 if so) or an `ARCHITECTURE.md`/`HOST_PROFILE.md` record; write the
  follow-up implementation task — the one that transforms `shake-hands` from inert to alive
  per the ruled design (owner, 2026-10-06), absorbing the script-execution spec legs
  re-scoped from LT-449 — including the compiled-path wiring and the runtime binding's
  adoption of the same policy function (one policy, two hosts, no drift). Nothing in the
  lazyload track waits on this session: LT-449 and LT-390 proceed independently.

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

- [ ] LT-446: Scope the `section-menu` migration (site chrome: external toggle by document id, imperative backdrop, layout-wide registration) — decide, then write the implementation task.
  **Area:** design
  **Area:** design
  **Updated (Architect, 2026-10-05):** filed from LT-111's sweep report (ruling 5) — the last
  component folder the "every example folder served compiled" exit criterion cannot close
  without, and NOT a mechanical migration: `section-menu` is the site's sidebar navigation,
  rendered by `server/templates/menu.ts` into every page layout, with four shapes the compiled
  surface has never carried together. A contributor who guesses at these is guessing wrong;
  rule first.
  **Design questions:**
  1. **The external toggle.** The hand-written twin wires `document.getElementById('sidebar-toggle')` — an element OUTSIDE the host — with `on(toggle, 'click')` + `bindAria(toggle, 'ariaExpanded')`. Does that wiring belong in the compiled component (a client-only setup side effect reading `document`, which is JS_GLOBAL) or moves to the layout template beside the button? The component-coupling argument cuts both ways: the id is a documented contract (`TOGGLE_ID`'s docblock cites LT-001 and the layout).
  2. **The imperative backdrop.** Created at connect (`createElement` + `prepend`) because it is meaningless without JS. Keep it imperative (a client-only setup side effect), or author it `hidden` in the template and let CSS/JS reveal it — the second changes the no-JS DOM shape, which the progressive-enhancement contract (no `.js` class → normal flow) currently keeps clean.
  3. **`expose({ open })` of a live State.** The twin exposes a `createState(false)` as the public prop (the toggle handler returns `{ open: !open.get() }`). Pin which compiled expose form carries a writable State-backed prop (not a Parser), and what the generated tag-map entry types (`HTMLElement & SectionMenuProps` — the members' entries must not diverge, TS 2717).
  4. **`.js`/`.ready` class sequencing.** `host.classList.add('js')` at connect, `.ready` one `requestAnimationFrame` later (gates the drawer's first-paint transition). Confirm both are client-only setup statements on the compiled path and that the rAF callback is a function-const/readable-client shape.
  5. **Layout-wide registration.** The migration flips the tag every docs page serves onto the compiled client. Verify the page bundle registers it (it is in the registry like any other corpus tag) and that `section-menu.spec.ts` runs unchanged against the served surface — plus which surface the LAYOUT pages get (the canonical artifacts, not a variant route).
  Decide each, then write the implementation task with the standard prerequisite set (LT-375, LT-374, LT-186, LT-426, LT-427, LT-428, LT-429). The `.spec.ts` is unchanged; `test:variants` covers the folder once the set exists.
  ---

### B — correctness

- [ ] LT-468: A client construct on an element in a server-rendered branch of a list item compiles clean, then throws in every item mount — refuse it, as every other scope does.
  **Area:** compiler
  **Needs:** LT-455
  **Area:** compiler
  **Filed (Architect, 2026-10-06, from LT-455's review):** the residue LT-455's entry scoped out,
  probed on that branch: `<em class="mark" onClick={() => {}}>` inside a server-known
  conditional's arm of a reactive-list item compiles on both surfaces, but the item mount mints a
  REQUIRED query for the element, so with the branch folded off every adopted and cloned item
  throws `MissingElementError` (contained per scope by LT-436) — the same failure LT-455 just
  fixed for nested lists. The same holds for a construct on a branch-held list's container
  itself, where a later required request upgrades `localFor`'s optional query back to required
  (by design) and reintroduces the throw through the new guard. Every other scope refuses the
  shape: the host walk rejects "a client construct below a branch root" (the deeper element
  exists only when its branch rendered), the arm walk stops at server branches and binds only
  branch key-derived attributes (`collectBranchKeyAttrs`), and reactive arms give conditional
  interactivity the existence-guarded arm treatment. The item walk's server-branch descent is
  the only walk that both descends and emits construct effects.
  **Ruling (Architect):** refuse, do not guard. A server-known branch's fold is fixed per render
  and per clone, so an `onClick` there is once-only addressing of markup that can never
  re-render — the trap LTC005 exists to prevent at host level. A nested reactive list earned its
  guarded support (LT-455) because the list itself is reactive and the branch only gates
  per-instance inclusion; a construct has no reactive core. The author's remedy is to make the
  condition reactive, which plans an arm set in the item and gets live switching with
  existence-guarded binding.
  **Change:** in `planReconcileItem`'s `visitElements` (`analysis/effects.ts`), when descending a
  server conditional's arms (the `inBranch = true` path LT-455 threaded), report a construct on
  any element — the branch roots included — through `diagnostic.unsupported` in the LTC005
  family, wording after the host rule with the item-specific remedy ("make the condition
  reactive"). Do not mint the query. The walk keeps binding branch key-derived attributes and,
  since LT-455, nested lists with guarded mounts; `emitConstructEffects` is simply not reached
  below a branch root any more.
  **Check:** both surfaces refuse the probed shape and a construct on the branch-held container;
  the refusal names the remedy. The LT-455 fixture still compiles and its client tests stay
  green (the placeholder `<li>` carries no construct). A reactive conditional with constructs in
  an item still compiles and binds. `check:corpus` stays clean (no example carries the shape).
  Catalog row for the new refusal instance; HOST_PROFILE.md's item/Mount-Scope passage and
  LE_TRUC_COMPILER.md's item-walk passage gain a sentence each; AGENTS.md's
  conditional-placement paragraph names the item case.
  **Channel/tier:** compiler check; tier 1 Prevented (the shape is statically decidable at
  planning time — the walk already knows `inBranch`); no runtime check, so nothing owes the
  sim-realm an entry beyond the catalog row.

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

