# TODO

Current iteration only. The queue is a per-task store (`queue/LT-NNN.md`, one file per task;
`BACKLOG.md`, `TODO.md` and `DONE.md` are views built by `bun run queue:build`). New tasks are
created in `queue/` with a `band:`; the Architect moves them by editing `status:` and the chain
in this file; contributors claim and annotate only through `bun run scripts/queue.ts`. Task IDs
are unique by construction — the filename is the ID; the "Next free task ID" line below
allocates the next one.

**Iteration opened 2026-10-06: the P6 cleanup round and the composition batch.** The
previous iteration (the corpus port and the pre-publish reshapes, opened 2026-10-02) closed on
2026-10-06. The `writer` recorded it in `CHANGELOG.md [Unreleased]`, and its 61 entries are
pruned (`queue/LEDGER.md`, seventh pass).

**Why now (Architect, 2026-10-06).** The first publish waits for the P6 cleanup round (owner,
2026-09-19), and the corpus port's close unblocked P6. P6 does two jobs. It finishes the
standing cleanup items, and it converts the compiled corpus from raw custom-element markup to
composed sub-components (LT-463), so that the corpus models ownership before the compiler
ships. The composition probe for LT-463 found two compose-lowering bugs (LT-460), and LT-468's
review found a third (LT-470). Those are equivalence gaps that more compose sites would only
multiply, so they run first. Section-menu (LT-469) closes the last uncompiled example folder.

**Rulings taken at planning (Architect with the owner, 2026-10-06).**
1. **Scope: P6 plus the two P2b compose fixes.** LT-460 and LT-470 join from P2b because they
   sit in the compose lowering that LT-461 extends and LT-463 exercises. The rest of P2b stays
   in the backlog, including the CSS-departures cluster behind LT-409.
2. **LT-461 is implementation, not a session.** The owner ruled its design on 2026-10-06, so its
   area flips from `design` to `compiler` and it becomes pickable. LTC081 is reserved for its
   rule 6.
3. **Compose enablers run one at a time** (track E): LT-460 → LT-470 → LT-481 → LT-482 → LT-488 → LT-461 all change
   compose-site lowering and its Mount Scope placement. Run in parallel, they would conflict at
   integration.
4. **LT-463 is split (owner).** Its two sites that need the children contract
   (`module-codeblock`'s scrollarea, and `form-checkbox` with its label as children) move to
   LT-462's implementation tasks. LT-463 converts the rest once tracks E and T have landed, so
   the iteration's exit does not wait on a design session.
5. **`module-todo` is edited in sequence:** LT-466 → LT-467 → LT-463. Each `needs:` field says
   so, and track T orders the first two.
6. **LT-135 is merged into LT-093 (owner).** It is the same free-name-through-a-const wall,
   fixed in one pass through the client-needed fixpoint. LT-093 does LT-135's half first.
7. **Two design sessions are scheduled (owner).**
   - LT-462 (the children contract → ADR 0048) runs after the LT-465 spike reports in
     `NOTES.md`.
   - LT-471 (D-32, the compiler's public contract) can run at any point. Nothing in this
     iteration waits on it, and it gates LT-254. Ruling it now means P1 opens unblocked.

   ADR 0048's implementation tasks join this chain if they are ruled before track K closes.
   Otherwise they are banded P6 and open the next iteration beside P1. The session only delays
   them; it never holds this iteration open.
10. **LT-462 ruled into ADR 0048 (owner, 2026-10-06), before track K closed.** Its tasks join as
    track C. Three owner rulings shape them:
    - **Self-nesting gates too little, never too much.** The lowered guard always re-includes a
      nested own-tag instance (LT-473).
    - **A child styles its declared role boxes**, at zero specificity (LT-475).
    - **The content model is `Children`'s second type argument** (LT-477).

    Track C serializes after track E (LT-472 needs LT-461), because the region marker changes
    compose-site lowering (ruling 3). LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477.
11. **LT-471 ruled D-32 (owner, 2026-10-06).** There is one published entry point, the corpus
    pass. It writes to `outDir`. `RegistryEntry` is narrowed to a public projection, and the
    generated-module API is under semver (`argsFromAttrs` excluded). The reshape is LT-480,
    banded P1. It opens the next iteration ahead of LT-254 and stays out of this chain, because
    P1 waits for this round.
8. **Acceptance criteria are goals, not constraints to satisfy by workaround** (ruling 10 of
   the last iteration still stands). The goals are byte-identical CSS across a variant set, a
   warning baseline of 0, unchanged Playwright specs and unchanged goldens. If a contributor can
   meet one only by bending the design, they annotate the task `blocked` and write the impasse
   into `NOTES.md`. LT-463's rule for surprises is the same thing for composition sites.
9. **Probe-first tasks may close as `done` with a finding.** LT-136 (re-verify against ADR
   0046) and LT-282 (TypeDoc may already regenerate `_media`) each state a premise to check. If
   the premise is false, close the task with a pinning test or a one-line finding rather than
   building the fix.

**The chain.**
- **E — compose enablers** — compose-site lowering, one at a time (ruling 3). LT-460 → LT-470 →
  LT-481 → LT-482 → LT-488 → LT-461. LT-460 through LT-488 are integrated (2026-10-07); LT-461
  is next.

  LT-481 and LT-482 joined from the reviews of LT-470 and LT-481: the arm-root pass planning,
  and the server-only `try` as a server-rendered branch. LT-488 rewords LT-470's remedy for a
  `try` site.
- **S — children-contract spike** — fed the LT-462 session (ruling 10). LT-465. Done.
- **T — module-todo** — ruling 5. LT-466 → LT-467. Done (2026-10-07).
- **G — layout graph** — the variant sets `main.ts` still registers through their `.ts` twins,
  so `test:variants` has never measured their compiled clients (found in LT-467's rework). It
  runs before LT-463, which converts them; LT-463 needs it. LT-485. Pickable now.
- **M — section-menu** — the last uncompiled example folder, beside everything. LT-469. Done (2026-10-07).
- **F — form-checkbox `.tsx`** — example folder only, pickable now. LT-464.
- **K — composition** — after tracks E, T and G (ruling 4; G added 2026-10-07). LT-463.
- **C — children contract** — ADR 0048, after track E (ruling 10). LT-472 → LT-473 → LT-478 →
  LT-474 → LT-475 → LT-476 → LT-477 → LT-479.
- **P — compiler cleanup** — independent of the compose machinery. LT-093 → LT-136.
- **Q — docs and build cleanup** — small, independent. LT-437 → LT-282 → LT-486.
- **Design gates** — area `design`: the Architect with the owner, never picked by `start-task`.
  LT-471 (D-32) — ruled 2026-10-06 (ruling 11).

**Deliberately not here.** P1 waits for this round: LT-254 now also needs LT-471 (ruled) and LT-480, its reshape, banded P1. The
CSS-departures cluster (LT-405, LT-407, LT-408 behind the LT-409 session) and the rest of P2b
stay in the backlog. So do LT-381, which needs the owner's sign-off because it changes the
census by design, and LT-246, which needs a settled census. The fetched-partials sessions
(LT-448, LT-450) stay in P7, and P2–P5 stay where they are.

**Exit criterion.** Every chain task except the two design sessions is reviewed and
integrated. LT-462 has ruled into ADR 0048, or its open state is recorded here (ruling 7). The
compiled corpus composes every site LT-463 names, and every example folder is served compiled,
section-menu included, and `examples/main.ts` registers no variant set through its `.ts` twin
(LT-485). No compose-lowering miscompile LT-460, LT-470, LT-481 or LT-482 names remains. The tier
census and the warning baseline are unchanged from the opening measurement below, except where
a task states a by-design change: LT-469 adds `section-menu: folded`, LT-467 removes
basic-pluralize's entry, and LT-093 may move components from Simulated to Folded. The warning
baseline stays 0. `typecheck`, the server suite, `check:contract`, `check:corpus`, `build:docs`
and `check:links` are green on the closing commit. The net line count of `server/compiler/` is
recorded against the opening measurement.

**Opening measurement (b63fbfed):** `check:corpus` exits 0. The tier census has 42
entries: 34 Folded, 8 Simulated, 0 Static. The compile-warning baseline is 0, and the
translation census has 0 gaps across 6 locales. `server/compiler/` has 79 modules and 37.3k
lines. That count covers every `.ts` file except `*.test.ts`, which is a wider net than the 30.4k
figure from 2026-10-02, so compare the closing measurement with this one only.

**Next free task ID: LT-489.** Next free diagnostic code: LTC086 (LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 is reserved for LT-136
if its re-verification confirms the shadowing; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->

### E — compose enablers

- [ ] LT-461: Handler args — an `on`-prefixed function arg the child places on an owned element lowers to a parent-side `on()`. — in progress ⚙
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

- [ ] LT-461: Handler args — an `on`-prefixed function arg the child places on an owned element lowers to a parent-side `on()`. — in progress ⚙
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

### G — layout graph

- [ ] LT-463: Compose sub-components instead of raw custom-element markup in the compiled corpus.
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

- [ ] LT-463: Compose sub-components instead of raw custom-element markup in the compiled corpus.
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

- [ ] LT-485: The examples layout graph registers module-calctable, module-cem-list and module-ticker through their `.ts` twins — switch them to the compiled clients.
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

### K — composition

- [ ] LT-463: Compose sub-components instead of raw custom-element markup in the compiled corpus.
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

### C — children contract

- [ ] LT-472: Children Region — the server's region marker and the verifier's re-include (ADR 0048 s1).
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

- [ ] LT-473: Scoped emission follows ownership — region re-include, child-side stop, self-nesting re-include (ADR 0048 s5/s6).
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** check:corpus, build:docs, check:links, test:variants
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s5/s6):** move the LT-465 prototype
  into `server/compiler/css-scope.ts` as production emission, inside `rewriteComplexSelector` and
  `emitScopedSheet`, not as post-processing.
  **Do:**
  1. **Child side.** A component whose template has a `{children}` insertion adds the
     pseudo-boundary `[data-children]:not([data-children="<tag>"])` to its scope boundaries, in
     both emissions.
  2. **Owner side.** A component whose template composes a child with children re-includes its
     own region.
     - Native: a second `@scope ([data-children="<tag>"]) to (<same limits>)` block. Its rules
       take the lowered lead with a `:where(:scope *)` subject anchor, placed before any
       pseudo-element. Host-subject rules and hoisted rules are left out.
     - Lowered: the guard gains the re-include clause. There is no second copy.
  3. **Self-nesting (owner ruling: gate too little, never too much).** Every lowered guard
     re-includes a nested own-tag instance and its subtree:
     `:is(T B > *, T B > * *):not(T B T, T B T *)` per boundary B. Always emit it, not only where
     the compiler sees nesting. Combine it with item 2's clause through the one helper from
     LT-472.
  4. **Fixtures.**
     - Port `server/tests/compiler/children-scope.test.ts` into `css-scope.test.ts` against the
       production emitter, then delete the prototype and its test.
     - Extend `examples/test/scoping/css-probe` with a compose site that passes children,
       covering the LT-465 matrix cells: `kid`, `btnint`, `childint`, `code`, `own2`, `kid2`.
     - Flip the existing lowered self-nesting assertions in `css-probe.spec.ts` (lines ~289–295)
       from "unstyled" to "styled".
  5. **Docs.** HOST_PROFILE § Styles, the s7 differences list, per ADR 0033 s7 as amended:
     self-nesting over-matches in both emissions, and children passed to a composed child are
     the parent's.
  **Variant sets:** the region flags derive from the template, so LTC051's boundary comparison
  must include them.
  **Check:** the lowered and native emissions of every corpus component that inserts `{children}`
  change only by the pseudo-boundary. Record the byte delta in the handoff against LT-465's
  table.

- [ ] LT-478: module-codeblock composes `<ModuleScrollarea>` and styles its own `pre`/`code` scoped.
  **Area:** examples
  **Needs:** LT-473
  **Gates:** check:corpus, build:docs
  **Area:** examples
  **Filed (Architect, 2026-10-06, split from LT-463; ADR 0048):**
  1. **The compose site.** Replace the raw `<module-scrollarea orientation="horizontal">` with
     `<ModuleScrollarea orientation="horizontal">`, passing the `<pre><code>{children}</code></pre>`
     as children. `first('code', …)` now verifies into the parent's own region (LT-472).
  2. **The styles.** Move the `:global { module-codeblock pre { … } module-codeblock code { … } }`
     rules into the scoped sheet as bare `pre`/`code` rules, and drop the `:global` block and its
     comment.
  **Check:** `bun run test:component module-codeblock` is unchanged, and the computed styles of
  `pre`/`code` are unchanged. Update `module-codeblock.md` if it describes the raw tag.

- [ ] LT-474: Declared roles — the `Children<Roles, Model>` type and the reach-in check (ADR 0048 s2; LTC083).
  **Area:** compiler
  **Needs:** LT-472
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s2):**
  1. **The type.** `Children<Roles extends Record<string, keyof HTMLElementTagNameMap> = {},
     Model extends 'any' | 'non-interactive' = 'any'>` is a phantom-branded `string`. It stays
     assignable to and from the rendered markup string, so `children = ''` defaults and existing
     `children?: string` sources keep compiling. Export it type-only beside `FactoryContext`
     (`types/src/component.d.ts`, re-exported from the package entry), with zero runtime bytes.
     The compiler reads the roles and the model from the declared parameter type, on both
     surfaces.
  2. **Role typing.** A child's `first('.<role>')`/`all('.<role>')` types as the declared tag's
     element.
  3. **LTC083, the reach-in.**
     - Channel: compiler. Tier: Prevented (ADR 0028).
     - Fires when a child's `first()`/`all()` selector matches nothing in the child's own
       template, its component inserts `{children}`, and its subject compound names no declared
       role class.
     - Such a selector can only resolve inside the content, so it reaches past the contract.
     - The fix-it names the role declaration.
     - Write the copy to `../writer/references/error-messages.md`.
  **Corpus survey first:** list every component that addresses its children today. For each,
  either declare roles or record it in `NOTES.md` (LT-463's rule for surprises). Do not widen
  LTC083's condition to pass a site.

- [ ] LT-475: Role styling — a child styles its declared role boxes at zero specificity (ADR 0048 s5).
  **Area:** compiler
  **Needs:** LT-473, LT-474
  **Gates:** check:corpus, build:docs, check:links
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; owner ruling: style roles, `:where()`'d):**
  1. **Which rules qualify.** A child rule qualifies when its subject compound contains a
     declared role class and its other compounds lie in the child's own template or are `:host`.
  2. **What it reaches.** The rule reaches role elements in the child's own Children Region and
     stops at a nested foreign region (`[data-children]` inside the region).
  3. **Specificity.** The whole subject compound is wrapped in `:where()`, so any parent rule with
     specificity wins, in both emissions.
  4. **Descending below a role** (`.tab .icon`) is ADR 0033 s6's boundary-descent face. Extend
     LTC071's check to it; do not add a new code.
  **Accepted residue to document in HOST_PROFILE § Styles:** a role class inside a raw custom
  element nested in the region still matches, because CSS cannot name "any custom element".
  **Check:** a browser fixture in `css-probe` shows four things:
  - a role box is styled by the child;
  - a parent rule on the same box wins at equal or higher specificity;
  - the role's descendants are not styled by the child;
  - a page-rendered instance (no marker) styles its page-authored roles.

- [ ] LT-476: One writer per property — parent bindings on a child-written role property conflict (ADR 0048 s3; LTC084).
  **Area:** compiler
  **Needs:** LT-474
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; ADR 0048 s3):**
  - **Registry.** The compose registry records, per child, the role properties its client writes:
    the role-targeted `watch` bindings (`bindProperty`, `bindAttribute`, `bindText`, `bindClass`,
    `bindVisible`, `bindStyle`, `bindAria`). `on()` return updates write host props, so they are
    out of scope.
  - **Check.** A parent binding on an element of its passed children that carries that role's
    class and binds the same property, attribute, class token or style property is LTC084.
  - **Channel/tier:** compiler, Prevented (ADR 0028).
  - **Where it reports:** at the parent's binding. The message names both writers.
  - **Copy:** to `../writer/references/error-messages.md`.
  **Check:** both surfaces. Pin a passing fixture where the parent binds a different property on
  the same role.

- [ ] LT-477: Content model — `Children<Roles, 'non-interactive'>` refuses interactive content at the compose site (ADR 0048 s4; LTC085).
  **Area:** compiler
  **Needs:** LT-474
  **Gates:** check:corpus, check:contract
  **Area:** compiler
  **Filed (Architect, 2026-10-06, LT-462 session; owner ruling (c), second type argument):**
  1. **Interactive content** means: `a[href]`, `button`, `input` (except `type="hidden"`),
     `select`, `textarea`, `label`, `details`, `iframe`, any `[tabindex]`, and `audio`/`video`
     with `controls`.
  2. **Registry.** The compose registry gains `interactive: boolean` per component, set when its
     template contains such an element, transitively through its own composed children.
  3. **LTC085.** A compose site of a child that declares `'non-interactive'` is an error when its
     literal children contain interactive content or compose an interactive component.
     - Channel/tier: compiler, Prevented (ADR 0028).
     - The message names the offending element or component and the child's declaration.
  4. **Documentation.** Document in HOST_PROFILE that page-authored HTML is unchecked and that
     TypeScript cannot carry the check.
  **Copy:** to `../writer/references/error-messages.md`.

- [ ] LT-479: module-todo composes `<FormCheckbox>` with its label as non-interactive children.
  **Area:** examples
  **Needs:** LT-463, LT-464, LT-477
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, split from LT-463; owner ruling (c) in LT-462):**
  1. **form-checkbox.** Takes its label as `children: Children<{}, 'non-interactive'>`, inserted
     where its template renders the label text. Change it in every variant-set member, and keep
     the CSS byte-identical (ADR 0039).
  2. **module-todo.** Replace its raw `<form-checkbox>` markup with `<FormCheckbox>`, passing the
     label as children.
  LT-466 has already moved the in-place editor out of the label, so the children are
  non-interactive and LTC085 passes. A remaining interactive site is a `NOTES.md` entry, not a
  workaround.
  **Sequence:** module-todo's fourth edit, after LT-466 → LT-467 → LT-463 (ruling 5).
  **Check:** `test:component form-checkbox module-todo` is unchanged.

### P — compiler cleanup

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
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


### Q — docs and build cleanup

- [ ] LT-437: Refresh the `cause-effect` skill for 1.6 — version stamp, list `map`/`forEach`, derived-list `stale` (LT-412 review follow-up).
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

- [ ] LT-282: `docs-src/api/_media` mirrors have no refresh path (LT-272 residue, unfiled until the LT-179 review).
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


- [ ] LT-486: Prose still cites the retired basic-pluralize — repoint each reference (writer).
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
