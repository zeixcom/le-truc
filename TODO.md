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
3. **Compose enablers run one at a time** (track E): LT-460 → LT-470 → LT-481 → LT-482 → LT-461 all change
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
  LT-481 → LT-482 → LT-461.
- **S — children-contract spike** — fed the LT-462 session (ruling 10). LT-465.
- **T — module-todo** — ruling 5. LT-466 → LT-467.
- **M — section-menu** — the last uncompiled example folder, beside everything. LT-469.
- **F — form-checkbox `.tsx`** — example folder only, pickable now. LT-464.
- **K — composition** — after tracks E and T (ruling 4). LT-463.
- **C — children contract** — ADR 0048, after track E (ruling 10). LT-472 → LT-473 → LT-478 →
  LT-474 → LT-475 → LT-476 → LT-477 → LT-479.
- **P — compiler cleanup** — independent of the compose machinery. LT-093 → LT-136.
- **Q — docs and build cleanup** — small, independent. LT-437 → LT-282.
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
section-menu included. No compose-lowering miscompile LT-460, LT-470, LT-481 or LT-482 names remains. The tier
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

**Next free task ID: LT-485.** Next free diagnostic code: LTC086 (LTC083–LTC085 are reserved for LT-474, LT-476 and LT-477; LTC082 is reserved for LT-136
if its re-verification confirms the shadowing; LTC081 is reserved for LT-461; LTC080 is
LT-453's; LTC079 is LT-447's, unused; LTC078 is LT-444's; LTC077 is LT-443's; LTC076 is LT-429's;
LTC075 is LT-355's; LTC074 is LT-186's; LTC073 is LT-417's; LTC072 is LT-429's; LTC071 is
LT-399's; LTC066–LTC070 are LT-304's; LTC065 is LT-394's; LTC064 is LT-268's; LTC062/LTC063 are
LT-274's; LTC061 is LT-383's; LTC060 is LT-375's; LTC059 is LT-374's; LTC057/LTC058 are LT-257's;
LTC056 is LT-358's).

---

<!-- entries -->

### E — compose enablers

- [ ] LT-482: A server-only `@try` is a server-rendered branch the plan walks don't treat as one — a `truc:pass` compose in its body compiles clean and never binds.
  **Area:** compiler
  **Needs:** LT-470
  **Gates:** test:server
  **Area:** compiler
  **Needs:** LT-470
  **Filed (Architect, 2026-10-06, from LT-470's rework residue, reproduced in review):** a `try`
  with no `pending` arm is not an arm set (`hasArmSet` in `server/compiler/walk.ts`): the server
  folds it once per render into its body or its catch arm. Both are server-rendered branches,
  but LT-470's host refusal (`validateArmSetPlacement`) keys `inServerBranch` on a
  `conditional` with `mode === 'server'` only, so `@try { <BasicChild truc:pass={…} /> } @catch
  (e) { … }` at the host compiles with no diagnostic and emits no `pass()`. The silent drop
  LT-470 closed for `@if` is still open one node kind over. The item walk
  (`planReconcileItem`'s `visitElements`) recurses only into server `conditional` arms, so
  inside a reactive-list item a server-only `try` is not descended at all. That walk also
  carries LT-468's construct refusal, so constructs there may be unplanned too.
  **Ruling (Architect):** a server-only `try`'s body and catch arm are server-rendered branches
  in every walk that tracks one. LT-468's and LT-470's refusals apply to them unchanged, with
  the same wording and remedy. No new diagnostic family and no new code.
  **Probe first:** probe the shapes below on both surfaces where the surface can spell a
  server-only boundary, and record what each one does today in this entry: (a) a `truc:pass`
  compose in a server-only `try` at the host; (b) the same inside a reactive-list item; (c) a
  client construct (reactive attribute, handler) on an element in a server-only `try` inside an
  item; (d) the same at the host; (e) a compose site as the root of a server-only `try`'s body or
  catch arm carrying `truc:pass` (LT-481's residue: `handleOptionalBranch` filters `isElement`
  and never sees a compose root, so the entries compile clean and never bind; probed live by
  LT-481's author). A shape that is already refused, or that already plans
  correctly, stays as it is. Fix only the shapes the probe shows silently unplanned or throwing
  at mount.
  **Change:** at the host, set `inServerBranch` for a `try` that is not an arm set. In the item
  walk, descend a server-only `try`'s body and catch children with `inBranch = true`, the way it
  descends server `conditional` arms. Mirror the item walk's key-attribute descent
  (`collectKeySites`, `collectBranchKeyAttrs`) only if the probe shows a key-derived attribute
  there is lost.
  Shape (e) is a fold-fixed branch like the others, so it takes LT-470's refusal. A server-only
  `try` arm is not an arm mount, so LT-481's arm-mount planning does not reach it.
  **Check:** each probed shape the change touches gets a both-surface test: refused with the
  LT-468/LT-470 message, or bound. A pass-less compose in a server-only `try` still compiles.
  Add a CHANGELOG Fixed line only if a shape that was silently dropped now fails the compile.
  **Channel/tier:** compiler check, tier 1 Prevented; no runtime check.

- [ ] LT-461: Handler args — an `on`-prefixed function arg the child places on an owned element lowers to a parent-side `on()`.
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

### M — section-menu

- [ ] LT-469: Migrate `section-menu` to `.tsx` with same-commit cutover — the site's sidebar chrome: external toggle by document id, imperative backdrop, layout-wide registration.
  **Area:** examples
  **Needs:** LT-375, LT-374, LT-186, LT-426, LT-427, LT-428, LT-429
  **Area:** examples
  **Scopes (LT-446 design session, 2026-10-06):** the last folder the "every example folder
  served compiled" exit criterion cannot close without, and the four shapes no compiled corpus
  member has carried together — an external toggle wired by `document.getElementById`, an
  imperative backdrop created at connect, a writable State-backed expose, and layout-wide
  registration. Every authored shape below is probe-verified against both front ends
  (both surfaces compile clean, byte-identical client/server modules) — do not re-derive them.
  **The set:** `section-menu.tsx` (served) beside a `section-menu.tsrx` twin; the hand-written
  `section-menu.ts` stays as the set's `.ts` twin (LT-111 ruling 5). Both compiled members emit
  byte-identical server renders and CSS (LTC051). Every member declares the identical
  `declare global { 'section-menu': HTMLElement & SectionMenuProps }` entry, each with its own
  identical `SectionMenuProps` alias (`{ open: boolean }`) — divergence is TS 2717.
  **Template:** root = host, `{children}` passthrough, one `<style>{css`…`}</style>` child —
  nothing else. The component is behavior-only chrome: the nav content arrives as page-authored
  children (`server/templates/menu.ts` and the example page author it), and the compiled server
  render must stay byte-compatible with `menu()`'s hand-written output plus the compose-site
  attributes (`id="sidebar"`) menu.ts writes itself. `module-scrollarea` inside the children is
  NOT a compile-time boundary (the template composes no child — ADR 0033 s7), so the sheet's
  `& module-scrollarea` selectors stay legal.
  **Setup rulings (LT-446):**
  1. **`expose({ open })` stays the live-State identifier form, verbatim:** `const open =
     createState(false)` + `expose({ open })`. The classifier's kind is `slot` (the
     no-diagnostic answer); the generated client carries both statements verbatim and the
     server module carries the signal declaration with the expose shim, so the fold sees the
     seed. `el.open = …` writes through the installed Slot — the unchanged spec's Programmatic
     Control probe proves it per surface. The toggle handler's `() => ({ open: !open.get() })`
     return-updates idiom is an authored `on()` call — library contract, carried as written.
  2. **`.js`/`.ready` sequencing is two bare client-only setup statements, verbatim:**
     `host.classList.add(JS_CLASS)` and `requestAnimationFrame(() => host.classList.add(READY_CLASS))`
     — `host` is context, `requestAnimationFrame` a JS global, the callback an inline arrow in a
     client-only statement. The five name constants (`JS_CLASS`, `READY_CLASS`, `OPEN_CLASS`,
     `BACKDROP_CLASS`, `TOGGLE_ID`) MOVE from module scope into setup — module-scope names are
     not client-known (LTC005; the module-scrollarea deviation note is the precedent). The
     served HTML carries no `.js` class — the progressive-enhancement contract holds by
     construction (probe: the server render emits `<section-menu>{children}</section-menu>`
     only).
  3. **The backdrop stays imperative:** `ensureBackdrop()` — a function const that finds or
     creates `:scope > .backdrop`, prepends it, and RETURNS the element (the existence check
     keeps the twin's tolerance of authored markup); wired by
     `on(ensureBackdrop(), 'click', () => ({ open: false }))` — the call is the `on()`
     argument, so no setup const ever holds a page-context value. Do NOT author the backdrop
     `hidden` in the template: the no-JS DOM shape stays byte-identical to the twin's (no
     backdrop element at all), which is the contract the sheet's header comment documents.
  4. **The external toggle stays component-owned; the guard lives in the helpers, the lookups
     inline as call arguments:** `on(document.getElementById(TOGGLE_ID), 'click', () => ({ open:
     !open.get() }))` — `on()`'s target accepts `Falsy` and the descriptor no-ops on it; and
     `watch(open, bindAria(document.getElementById(TOGGLE_ID), 'ariaExpanded'))` — `bindAria`
     accepts nullish targets and makes every handler a no-op. The twin's `if (toggle)` guard is
     therefore built into the runtime; do NOT hold the element in a setup const (a const whose
     value reads `document` is a build error, LTC054 — page context), and do NOT call
     `watch`/`on` inside a function const (LTC045 — the ambient collector is gone by the time a
     deferred callback runs). NOT the layout's job: the drawer state has one owner (the
     component's exposed Slot), the id is the documented chrome contract (TOGGLE_ID's docblock,
     LT-001, SERVER.md), and the wiring must exist exactly when the drawer behavior does.
     The outside-click handler re-queries the toggle inside the descriptor body — no held
     reference.
  5. **Document-level listeners ride the twin's `watch(() => true, descriptor)` idiom
     verbatim** (module-listnav's compiled form is the corpus precedent): raw
     `addEventListener`/`removeEventListener` on `document`, `open.get()`/`open.set()` inside,
     cleanup returned. Keep the twin's `el instanceof HTMLAnchorElement` check — which needs
     the rider below.
  **Compiler rider — JS_GLOBALS:** `server/compiler/vocabulary.ts`'s `JS_GLOBALS` set lists
  `HTMLButtonElement`…`HTMLTextAreaElement` but NOT `HTMLAnchorElement`, so the twin's
  `instanceof HTMLAnchorElement` outside-click check is a false unknown name and refuses with
  LTC005 (probe-verified; a `nodeName === 'A'` re-spelling compiles but deviates from the twin
  for no reason once the set is fixed). Add the entry — the set's own docblock scope ("DOM
  globals (generated handlers reference element types)") — and pin it in
  `server/tests/compiler/globals.test.ts`. No diagnostic changes, no ADR 0028 inventory change.
  **Styles:** re-author the sheet to ADR 0033 form — `:host`-led (a rule led by the component's
  own tag is LTC066, fix-it `:host`); the page-shell rules (`.docs-body`, `.docs-main`,
  `#sidebar-toggle`, `.quicklinks`, `.docs-header-bar`, `header`) ride the two whole-rule
  `:global` forms, the at-rule-conditioned ones inside a bare `:global { @media … }` block
  (LTC069); `module-dialog`'s `:global(body.scroll-lock)` is the corpus precedent and the
  sheet's header comment documenting the `.docs-body`/`.docs-main` exception stays. Members'
  CSS byte-identical (LTC051). `examples/main.css` flips its import to the generated sheet.
  **Cutover:** `examples/main.ts` imports
  `../server/generated/components/section-menu.client.ts` — the canonical client, so the
  LAYOUT pages serve the canonical `.tsx` surface (main.js bundles it on every docs page) and
  `/test/section-menu`'s default page is the registry's selected surface; `?surface=` and the
  runner's `TEST_SURFACE` reach the `.ts` twin and the `.tsrx` variant
  (`routes.ts` `resolveSurfaceModule`). `server/templates/menu.ts` stays hand-written and
  byte-compatible with the compiled server render — the markup contract SERVER.md documents;
  `templates/menu.test.ts` keeps pinning it, unchanged. The authored `section-menu.html` is
  regenerated from the compiled server render (the module-todo header-comment pattern),
  keeping `#sidebar-toggle` before the host and `#outside-target` after `<main>`.
  `examples/tsconfig.json` lists the new members; the strict `IntrinsicElements` table in
  `server/compiler/frontend/tsx/host-profile.d.ts` gains `type SectionMenuAttrs =
  CommonLightDom` and the `'section-menu'` entry (a migration extends the table in the same
  commit). The component has no `.md`/gallery entry before or after (structural chrome).
  **Tier:** the component stays Folded — no setup const holds a page-context value (probe: no
  LTC013 routing signal, no LTC054). The tier-corpus census pins +`section-menu: folded`; that
  shift is this entry's by-design change.
  **The spec is unchanged.** `test:variants section-menu` is the acceptance gate: the unchanged
  suite (drawer, toggle, aria reflection, programmatic control, Escape/outside-click/link-nav
  close) passes against all three surfaces.
  **Check:** gates inside the worktree: `typecheck`; `test:server` (extend the
  parity/equivalence-audit snapshots for the new generated modules; `templates/menu.test.ts`
  stays green unchanged); `check:corpus` (census re-pin); `check:contract`; `test:variants
  section-menu` (browser gate — LT-111 proved it can run green in the sandbox; else an
  owner-run leg); `test:component section-menu` on the default page. `build:docs` +
  `check:links` when the JSDoc/host-profile changes are doc-visible.
  **Channel/tier:** no new runtime check and no diagnostic change; the rider is a vocabulary
  omission fix (compiler) that removes a false LTC005 — it adds no check, so nothing owes the
  catalog or the ADR 0028 inventory an entry.

  ---

### F — form-checkbox `.tsx`

- [ ] LT-464: form-checkbox gains a .tsx spelling.
  **Area:** examples
  **Gates:** check:corpus, test:variants
  **Area:** examples
  **Filed (Architect, 2026-10-06, owner request):** `form-checkbox` exists only as
  `form-checkbox.tsrx`. Add `form-checkbox.tsx` beside it as a variant-set member (ADR 0039): same
  canonical tag, its own `declare global` `HTMLElementTagNameMap` entry (s4), byte-identical CSS,
  typed second parameter `FormFactoryContext<FormCheckboxProps>` (LT-209). Keep the current
  `label: string` arg — the switch to `children` waits for LT-462's children contract and lands in
  LT-463. The `.tsx` member becomes the served surface; the `.tsrx` twin stays.
  **Verification:** check:corpus, test:variants, `form-checkbox.spec.ts`.

### K — composition

- [ ] LT-463: Compose sub-components instead of raw custom-element markup in the compiled corpus.
  **Area:** examples
  **Needs:** LT-460, LT-461, LT-466, LT-467
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

- [ ] LT-093: Make LTC004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Area:** compiler
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires LTC004's "never rendered"
  message, though the signal IS credited as rendered (`thunkRendered`) —
  `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client
  module may not define the name. **Step 1 (small):** split the diagnostic — "rendered but
  initializer not client-portable" (name the offending free names) vs "never rendered".
  **Step 2 (goal):** feed signal-initializer free names into `computeClientNeededNames` as
  client-needed seed positions so plain-setup and import-local names in initializers place
  client-side; the fixpoint has grown accretively (clientSetup statements, composed refs, pass
  set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was
  judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames`
  `badFreeNames` widening (currently unexercised after the LT-091 redesign), and the LT-116
  finding that `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value`
  thunks, which now lack `String()` coercion under property dispatch — consult `inferredType` so
  the coercion fires for number-typed signal reads (no corpus offender today; add the unit test).
  **Absorbs LT-135 (owner, planning 2026-10-06)** — the same free-name-through-a-const wall from
  the other direction. LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement
  reads it, but only through `containsSignalGet(stmt.node, …)` on the statement itself, so
  hoisting a predicate into a plain setup const (`const isOpen = () => open.get(); watch(() =>
  !isOpen(), …)`) un-credits the signal and the component tiers into Simulated with no warning.
  Resolve reads through the `component.plainSetup` consts a statement names, with the same
  one-hop widening `computeClientNeededNames` already does. Flip the negative case pinned in
  `server/tests/compiler/client-setup-credit.test.ts`, and drop the "repeat the predicate"
  workaround comment in `form-combobox.tsrx` (in the `.tsx` member too, if it carries one) if the
  fix makes it unnecessary. **Order inside the task:** do the LT-135 half and step 1 first; step 2
  builds on both.
  **Channel/tier:** compiler only. Step 1 re-words a routing reason, not a diagnostic (LTC004
  rides the tier census, ADR 0029); no new LTC code, no runtime check.
  **Re-triaged 2026-09-06 (LT-165 step 5 landed).** The ADR 0029 concern stands and has
  sharpened: LTC004 left the diagnostic channel, so a false firing on a fully
  phase-1-resolvable component now tiers it into simulation **silently** — it buys a realm and
  says nothing. It is not invisible, though: the tier census records the reason with its
  LTC004 origin and line, so the failure mode is inspectable rather than lost. Stays in P6 on
  that basis. **Cheap check to run at the end of wave 4, before this task:** scan the census for
  any Simulated component whose ONLY reason is a LTC004 origin — each one is a candidate false
  firing, and the list sizes this task's real payoff.


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

