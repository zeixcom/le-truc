# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): wave 4, second batch — six more migrations, and the
three gates they trip.** Drawn from [BACKLOG.md](BACKLOG.md)'s P3 and P5 bands. The previous
iteration ("wave 4 at cadence") is fully landed and reviewed: LT-098–LT-103 serve as compiled
`.tsx` with their twins retained, and every gate they tripped is closed (LT-291, LT-292,
LT-295, LT-296, LT-299, LT-307, LT-312, LT-313, LT-314, LT-316–LT-318, LT-320–LT-324, LT-327).
Compacted records are in `DONE.md`; the public summary is in `CHANGELOG.md [Unreleased]`.

**Why these fifteen.** The six migrations are the text-shape rest of wave 4: every remaining
component that LT-280's per-item-channel design does not gate. Leaves: **LT-104** lazyload,
**LT-106** context-media, **LT-108** carousel and **LT-095** blogmeta (the contract reshape
decided 2026-08-29). Composites: **LT-105** coloreditor and **LT-107** listnav. They trip three
gates, which run first:
- **LT-303** (`<truc:try>`): lazyload is the first `.tsx` migration to author a boundary.
- **LT-325** (generated tag-map typings): coloreditor and listnav are `.tsx` parents that query
  `.tsrx` children. Without it, the hand-listed `examples/tsconfig.json` grows by four more
  clients, the pattern LT-312 retired for compose imports.
- **LT-301** (loop inside a branch): no component in this batch nests one. It is here because the
  shape silently binds only the first item's handler, which is the worst kind of trap for a
  migration to meet by accident. **LT-300** reviews the LTC005 phrases it extends, in one pass.

The parallel slot carries the last iteration's follow-ups: **LT-330** (the `@case` half of
LT-327's false Folded), **LT-329** (`check:sim` green on a clean tree, so the gate reads true),
**LT-328** (HOST_PROFILE after LT-316/LT-320), and two ruled P3 riders, **LT-326** (LTC033 over
loop iterables) and **LT-302** (harness-import aliasing).

**Pulled in (owner, 2026-09-25): LT-338 → LT-319.** The migrations made LTC012's "needs a
`first()` reference" rule visible as dead weight: coloreditor declares eleven references and
listnav one, none of them read, only to satisfy it. LT-338 retires the rule; LT-319 then gives
colorinfo's shared-class `basic-number` sites a `truc:pass` spelling.

**Order.** LT-338 → LT-319. LT-303 → LT-104 → LT-107 (listnav composes lazyload). LT-325 before LT-105 and LT-107.
LT-301 and LT-300 before any migration that meets a loop inside a branch; none is expected.
LT-095, LT-106 and LT-108 are ungated and can start at once. LT-105 and LT-106 write their spec
against the `.ts` twin before migrating (LT-324 precedent).

**Deliberately not here.** LT-109/LT-110/LT-111 wait on LT-280's design grilling, which is
architect work and not scheduled in a developer iteration. LT-309–LT-311 (codeblock
follow-through and two designs) still wait for evidence: this batch shows whether the
root-attribute and compose-event patterns recur. The i18n chain (LT-242 → LT-233 → LT-250), the ADR 0037
implementation (LT-274–LT-276) and the ADR 0033 CSS track (LT-268 → LT-304/LT-306) do not
contend with this batch and keep for later iterations. The P1 publish track stays behind P6.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained
(LT-095, LT-104–LT-108), every spec green on every surface they carry, zero warnings, and tier +
reason recorded per migration. Coloreditor and context-media carry specs of their own. No `boundary(`
survives in code (LT-303). *(Amended 2026-09-25, owner: lazyload keeps its hand-written
`watch`; the `<truc:try>` spelling moves to LT-334.)* `bun run build:docs` passes.
`examples/tsconfig.json` hand-lists no generated client (LT-325). A loop inside a branch fails
LTC005 on both surfaces (LT-301, copy reviewed by LT-300). A `@case` test over a
context-member-seeded signal routes Simulated (LT-330). `bun run check:sim` exits 0 (LT-329). A
build-time shuffle in a loop iterable fails LTC033 (LT-326). Args named `items`/`esc` render on
both surfaces (LT-302). A composed `truc:pass` site needs no `first()` declaration, and
coloreditor/listnav carry none they do not read (LT-338). colorinfo passes to its `basic-number`
sites through `truc:pass`, with no imperative `pass(all(…))` (LT-319). The census is 27/2/0 before the batch; each migration adds its own entry.

**Next free task ID: LT-339.**

---

### Gates (run first)

All three gates landed and were reviewed on 2026-09-25 (LT-325, LT-301, LT-300; see `DONE.md`).

### Migrations (LT-104 before LT-107; LT-095, LT-106, LT-108 ungated)

- [x] LT-104: Migrate `module-lazyload` to `.tsx` with same-commit cutover — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.
  **Handoff (2026-09-25):** serves as compiled `.tsx`, twin retained. **Tier: Simulated**, one
  routing signal: LTC043, `setHTML` reads the `contentEl` ref in setup, but only a `watch`
  consumes it (NOTES). Census 27/3/0. **The exit criterion's `<truc:try>` clause is not met.**
  The owner ruled on 2026-09-25 to keep the twin's hand-written `watch(content, { ok, nil, stale,
  err })`, because the compiled boundary cannot express this contract (NOTES; the header of
  `module-lazyload.tsx`). No `boundary(` survives. Compiler fix: the client factory now
  destructures a context member that only setup declarations read (`host` in the task callback),
  in `analysis/plan.ts`, with a test in `client-context-members.test.ts`. The spec was not run:
  the sandbox cannot bind port 3000, so `test:component module-lazyload` and `test:variants`
  are owed.
  **Review (Architect, 2026-09-25):** code approved. The `<truc:try>` exit clause moves to LT-334
  (owner ruling). The over-routing becomes LT-333, and the destructuring diagnostic LT-337.

- [x] LT-107: Migrate `module-listnav` to `.tsx` with same-commit cutover — reviewed ✓ (code); awaiting LT-332
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working. Note: LT-200 (merged with `next`)
  moved this component's initial hash sync into effect activation — the ported template must
  keep that shape.
  **Planning note (2026-09-25):** composes `module-lazyload` and `form-listbox`, so it runs
  after LT-104 and needs LT-325's generated tag-map entries (form-listbox is a `.tsrx` child).
  form-listbox is Simulated (LTC034), so expect listnav to land **Simulated on `compose-read`**,
  like form-combobox. Record that as its tier and reason; do not reshape the component to dodge it.
  **Handoff (2026-09-25):** serves as compiled `.tsx`, twin retained. **Tier: Simulated**, one
  routing signal: `compose-read` of the Simulated `form-listbox`, as predicted. Census 27/4/0. It
  composes `FormListbox` and `ModuleLazyload` (both `.tsx` members). The twin's `pass()` is now
  `truc:pass` on the lazyload compose site, so `module-lazyload.tsx`'s args declare
  `'truc:pass'?: { src?: () => string }`. The initial hash sync stays in effect activation
  (LT-200). The hash helpers moved to `listnav-hash.ts` as pure functions of the first option's
  value. The client imports that module, and `module-listnav.test.ts` now tests it rather than
  a copy. Run it with `bun test examples/module/listnav`: no package script runs it. Compiler:
  `JS_GLOBALS` gains `location` and `history`, which are already in `PAGE_CONTEXT_GLOBALS`, so
  a server fold over them still fails LTC054. Host profile: `nav`, `module-listnav`. Not run in
  a browser, because the sandbox cannot bind a port. A contract mismatch, inherited and not
  fixed, is in NOTES.
  **Review (Architect, 2026-09-25):** code approved as a faithful migration. The `value`/`data-value`
  mismatch is a live docs bug, now LT-332 (in this iteration). listnav is not accepted until
  LT-332 lands its spec.

- [x] LT-105: Migrate `module-coloreditor` to `.tsx` with same-commit cutover — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).
  **Planning note (2026-09-25):** composes `form-textbox`, `form-colorgraph` and the colorscale
  child (`.tsrx`) plus nine `module-colorinfo` sites. Each colorinfo site carries a distinct class
  (`.base`, `.lighten80` … `.darken80`), so every site gets its own `truc:pass` and LT-319 is not
  tripped. The `.tsrx` children need LT-325's generated tag-map entries: do not hand-list more
  clients in `examples/tsconfig.json`. **No spec exists:** write one against the `.ts` twin first
  (LT-324 precedent), so `test:variants` verifies both surfaces.
  **Handoff (2026-09-25):** serves as compiled `.tsx`, twin retained. **Tier: Folded**, no
  routing signals. Census 28/4/0. It composes `CardColorscale`, `FormColorgraph`, `FormTextbox`
  (typed through LT-325's generated `.tsrx` entries, nothing hand-listed) and nine
  `ModuleColorinfo` sites. Every site gets its own `truc:pass`, and the twin's two `for` loops
  are unrolled. Server renders beyond the twin: the textbox value and description, and every
  step's label and color. `module-colorinfo.tsx` gains an additive `open = true` arg (the twin
  opens only the base step) and a `'truc:pass'?: { value?, label? }` args key. **Spec:**
  `module-coloreditor.spec.ts` was written against the twin (12 tests) with expected hex strings
  computed via culori. It is **not run**: the sandbox cannot bind port 3000, so
  `test:component module-coloreditor` and `test:variants` are owed. Also: two canvas
  classifications in `sim/classifications.ts` (NOTES: attribution leak), and `emit-tier.test.ts`
  strips comments before its undeclared-name scan (a JSDoc "color" read as a use).
  **Review (Architect, 2026-09-25):** approved. colorinfo's `open` arg is accepted as additive. The
  attribution leak becomes LT-335, whose fix retires the colorinfo classification.

- [x] LT-106: Migrate `context-media` to `.tsx` with same-commit cutover — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.
  **Planning note (2026-09-25):** write the spec against the `.ts` twin first (LT-324 precedent).
  A browser check alone leaves `test:variants` with nothing to verify on either surface.
  **Handoff (2026-09-25):** serves as compiled `.tsx`, twin retained, setup verbatim. **Tier:
  Folded**, no routing signals: nothing reactive reaches markup, and a consumer renders its
  fallback before JS, as with the twin. Census 29/4/0. The template is the root, its four
  breakpoint attributes, and `children`. **Cutover blocker, fixed:** `card-mediaqueries` imported
  the context keys from `context-media.ts`, whose module body defines the twin. Its generated
  client would have registered the twin ahead of the compiled one. The keys and types now live
  in the side-effect-free `media-contexts.ts`. The twin re-exports them, so its public exports
  are unchanged, and `card-mediaqueries.tsrx` imports from there. The bundle now defines
  `context-media` once. **Compiler:** an `import type` named only by carried declarations (type
  aliases, `declare global`, the server's parameter types) is now placed in those modules, not
  flagged LTC014 and dropped (`imports.ts`, `assemble-ir.ts`, test
  `type-import-placement.test.ts`). `JS_GLOBALS` gains `Map`/`Set`/`WeakMap`/`WeakSet`: the
  server module stubbed `Map` as `refStub` and threw on `new Map`. **Spec:**
  `context-media.spec.ts` was written against the twin (10 tests: seeded media, provision to a
  consumer, live updates, breakpoint attributes). It is **not run**: the sandbox cannot bind port
  3000, so the browser check, `test:component context-media` and `test:variants` are owed.
  **Review (Architect, 2026-09-25):** approved. **Ruling:** a provider's context keys live in a
  module with no side effects, never in the component module, because importing a component
  module defines the element. The docs snippet and the rule go to LT-189 item 14.

- [x] LT-108: Migrate `module-carousel` to `.tsx` with same-commit cutover — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.
  **Handoff (2026-09-25):** serves as compiled `.tsx`, twin retained. **Tier: Simulated**, three
  LTC013 routing signals: the `all()`-bound `panels`/`dots`/`buttons` consts. Their consumers
  are all client-only (`on`/`watch`/`each`), the same over-routing class as LT-104's LTC043
  (NOTES). Census 29/5/0. The template mirrors the `carousel` Markdoc schema: a hidden heading,
  per-slide tabpanel (`h3` + `.slide-content` via `truc:html`), and nav with prev/next and one
  dot per slide. Both loops render **static seeds only** (first slide current, first dot
  selected). Setup keeps the twin's two `each()` blocks, the observer effect with cleanup, the
  `index` watcher and the handlers. Per-item thunks could not replace the blocks. The slide
  predicate reads the tabpanel collection, which LTC005 rejects in a loop body. A dot thunk over
  `host.index` would fold `index`'s DOM-harvest initializer (LTC046). Slide ids come from a
  `carouselId` arg (LTC042). Setup deviations: a const record for the two `let`s, `clamp` in
  setup, the collection named `panels` (`slides` is the arg), and `index`'s initializer calls
  `all()` inline. **Four compiler fixes**, all hit by the twin's verbatim setup: (1)
  `to-estree.ts` had no `VariableDeclarationList` case, so a `.tsx` `for…of`/`for`
  loop variable lost its declaration and read as a free name (LTC005). (2) LTC045 flagged
  `watch()` inside an `each()` callback, which runs in its own collector
  (`module-scans.ts`). (3) The client destructure now also collects `all`/`first`/… read only
  by plain consts (LT-104's `plan.ts` fix widened, test added). (4) `JS_GLOBALS` gains
  `IntersectionObserver`, beside `ResizeObserver`. The spec is unchanged and **not run**: the
  sandbox cannot bind port 3000, so `test:component module-carousel` and `test:variants` are
  owed.
  **Review (Architect, 2026-09-25):** approved. **Ruling:** the LTC045 exemption for a helper
  called directly in an `each()` callback is correct, because `each()` runs the callback in its
  own collector. A function nested inside that callback is still deferred. The over-routing is
  LT-333, and the LTC046 wording is LT-189 item 13.

### Compose addressing (pulled in 2026-09-25; LT-338 before LT-319)

- [ ] LT-338: Auto-address composed `truc:pass` sites — retire LTC012's "needs a `first()` reference" rule.
  **Skill:** le-truc-dev (copy: tech-writer)
  **Context:** `emitComposeEffects` (`analysis/effects.ts`) rejects a compose site that has `pass`
  but no `ref` attr, with `composedPassRequiresRef`. That `ref` attr exists only when an author
  `first()` resolves to the site (`analysis/compose-refs.ts`). The rule is a leftover from
  `ref={}`, which LT-127 replaced one-for-one. The stated reason, "server args aren't guaranteed
  to render as DOM attributes", stopped being true when LT-090/LT-320 pinned `class`/`id`/`data-*`
  pass-through as an invariant. The function already builds the selector itself
  (`${childTag}${discriminator}` from the registry and `composeDiscriminatorClause`), so the ref
  supplies only a variable name. HOST_PROFILE says as much ("It supplied only the query
  variable's name").
  **Design (Architect):**
  1. With no `ref` attr, a compose site that carries `pass` calls
     `addQuery(sanitizeVarName(childTag), selector, 'one')`. This is the raw-custom-element
     fallback (`effects.ts`, the `refAttr?.name ?? sanitizeVarName(node.tag)` site). The
     `ref`-attr path is unchanged: an author `first()` still names the query and carries its
     reason text. A bare `first()` with no `pass` is unchanged too.
  2. The order inside the function becomes: resolve `childTag` (LTC011 if missing), then the
     discriminator (`unaddressableElement` if same-source siblings have none), then the query.
     The `ambiguousComposeNodes` suppression stays.
  3. Compose sites inside `@if`/`@try`/loop arms go through whatever addressing the
     `ref`-attr path gets there today. Do not invent new cardinality handling. If a branch path
     turns out to depend on the author ref, write it up in NOTES rather than widening scope.
  4. Delete `diagnostic.composedPassRequiresRef` and its tests. Add a test showing that a
     reference-less `truc:pass` compiles to the same client as the one with a `first()`
     declaration, on both surfaces.
  5. Delete the unread declarations and their "LTC012 needs …" comments: coloreditor's nine
     `colorinfo*`, plus `colorgraph`/`colorscale` if unread; listnav's `lazyload` if unread.
     Keep any reference the factory actually reads.
  **Channel/tier:** retirement. One LTC012 message row goes away. LTC012 stays as a code for
  the other four rows. Nothing moves to runtime: the site is now always addressed, and the
  unaddressable case keeps its compiler diagnostic (tier 1). **Tech Writer** reviews the
  retirement: the `diagnostics.ts` row, the `effects.ts`/`compose-refs.ts` doc comments, the
  HOST_PROFILE addressing section (l. 123, 183), VOCABULARY_LEDGER if the row is listed, and the
  error-code docs page.
  **Check:** `bun test server/tests/compiler`, `check:corpus`, `test:variants` for coloreditor
  and listnav. Generated clients are byte-identical apart from query variable names.

- [ ] LT-319: One `truc:pass` spelling for several same-discriminator compose sites (NOTES LT-098).
  **Skill:** le-truc-dev (copy: tech-writer)
  **Context:** module-colorinfo renders each channel's `basic-number` twice with one class
  (`.lightness`, `.chroma`, `.hue`), so `composeDiscriminatorClause` finds no unique clause and
  a per-site `truc:pass` is unaddressable. The migration kept the twin's imperative
  `pass(all('basic-number.<channel>'), …)`. That form stays sanctioned, as a client-only setup
  statement with only the runtime backstop (ADR 0028 tier 2). **Ruling (owner, 2026-09-25):**
  identical `truc:pass` objects on sites that share a discriminator lower to one
  `pass(all(selector), …)`, which regains the compile-time check. Needs LT-338.
  **Design (Architect):**
  1. When `composeDiscriminatorClause` returns null, look for a clause shared by a group of
     same-source sites: the first class token (or `id`/`data-*`, same priority order) whose
     matching siblings ALL carry `pass`. Every site in that group must carry a
     **textually identical** `truc:pass` object: the same prop set, and the same `exprText` for
     each get/set thunk after whitespace normalization. No semantic equivalence.
  2. If so, emit once per group: `addQuery(name, selector, 'many')` and one `pass` effect over the
     collection, with `checkPassEntries` run once against the child tag. Emit nothing more for
     the other members. Dedup is by selector, so `addQuery` already returns the shared name.
  3. If the objects differ, or a site in the group has no `pass`, keep the `unaddressableElement`
     error. Extend its text to say that identical `truc:pass` objects share one query, and that
     differing ones need a distinct class per site.
  4. Confirm that the `pass` effect plan and emitter accept a `'many'` query. The runtime does
     (`pass(all(…))`). If the IR only types `'one'`, widen it there, not with a cast.
  5. colorinfo (`.tsx` and `.tsrx` members) replaces its three imperative `pass(all(…))` calls
     with `truc:pass={{ value: () => host.<channel> }}` on each `BasicNumber` site. The `.ts` twin
     keeps its imperative form.
  **Channel/tier:** compiler, tier 1. The group gets the same LTC012 legality checks
  (`passPropNotExposed`/`passPropNotSlotBacked`) a single site gets, where the imperative form had
  only the tier-2 runtime backstop. **Tech Writer** reviews the extended `unaddressableElement`
  text and the HOST_PROFILE addressing paragraph.
  **Check:** compiler tests for the identical group (one `'many'` query), a differing group
  (error), and a mixed pass/no-pass group (error), on both surfaces. `test:variants` for
  module-colorinfo and module-coloreditor (which composes colorinfo).

### Review follow-up (in iteration, 2026-09-25)

- [ ] LT-332: The docs' Markdoc `listnav` options no longer match the compiled form-listbox contract — examples navigation is broken (LT-107 review).
  **Skill:** le-truc-dev
  **Context:** Verified 2026-09-25 against a fresh `build:docs`: `server/schema/listnav.markdoc.ts`
  renders option buttons with `value="…"` and no `data-value`/`data-label`. The served
  form-listbox client (compiled from `form-listbox.tsx`; the `.tsrx` member's client reads the
  same attributes) reads
  `option.getAttribute('data-value')!` and `…('data-label')!`. So on `docs/en/examples.html`
  every `optValue` is `null`, a click writes `null` into `host.value`, and the filter predicate
  throws on `null.toLowerCase()`. module-listnav's hash sync has the mirror bug: it reads
  `.value`, which only the schema markup has, and it queries inside form-listbox's owned
  markup (HOST_PROFILE § data account, bullet 3).
  **Design (Architect):** one contract, the compiled component's, read through its public
  surface.
  1. `listnav.markdoc.ts` (and any other schema emitting form-listbox options:
     `cem-list.markdoc.ts`, check) emits `data-value`/`data-label` on each `role="option"`
     button. A `value` attribute is not part of the contract; drop it.
  2. form-listbox exposes a read-only **`options: FormListboxOption[]`**, the unfiltered
     projection of its own option buttons in document order. It is `visibleOptions` without
     the filter, and the same children-are-data read (LT-119). The same-named server arg is
     the render channel for the same value, so this is one site in three roles, not LTC039's
     duplication. Both `.tsx` and `.tsrx` members change; keep their CSS byte-identical.
  3. module-listnav (`.tsx` and the `.ts` twin) reads `listbox.options[0]?.value` and
     `listbox.options.some(o => o.value === v)`. It drops both `query(listbox, …)` reach-ins.
     `listnav-hash.ts` keeps its pure signatures.
  **Channel/tier:** none. No check changes.
  **Check:** a Playwright spec for module-listnav (the component has none): selecting an
  option loads its partial, a hash on load selects the matching option, and filtering does not
  throw. Plus a browser check of `docs/en/examples.html`'s navigation. `blog-pages`/schema tests
  updated to the attribute form. Public API change on form-listbox, so it goes to review.

### Follow-ups and riders (parallel slot)

- [ ] LT-330: `@case` tests are render positions — credit them, so a context-member seed cannot fold (LT-327 review).
  **Skill:** le-truc-dev
  **Context:** LT-327 routes render credit through `carriedBy`, but `@switch` arms carry only
  `testText: string | null` in the IR (`ir.ts`, the `switch` variant), with no AST node, so
  `harvest.ts` cannot credit them. Reproduction (a `.tsrx`, confirmed at review):
  `const count = createMemo(() => all('li').get().length)`, `const label = () =>
  String(count.get())`, `watch(label, bindText(out))`, and `@switch (mode) { @case label(): {…}
  @default: {…} }`. That compiles **Folded** with zero routing signals, and the server module
  reads `all` undeclared (`case label():`), the same false Folded as LT-327. The `@if (label()
  === '1')` spelling already routes Simulated. **Rule:** add `test: AstNode | null` beside
  `testText` on `switch` cases, populated in both front ends (`frontend/tsrx/lower-template.ts`,
  `frontend/tsx/lower-tsx.ts`; both already hold `raw.test`), and credit it in `harvest.ts`'s
  render-credit walk next to `node.discriminant`. No new diagnostic: it is a routing change, not
  a check (ADR 0028 channel: none).
  **Accept:** the reproduction routes Simulated (LTC004) and gets a test in
  `client-setup-credit.test.ts`, on both surfaces if the `.tsx` front end can express a case test
  over a setup const. Census unchanged (27/2/0).

- [ ] LT-329: `check:sim` fails on a clean tree (`renderFormColorgraph` without `i18n`).
  **Skill:** le-truc-dev
  **Context:** `scripts/sim-portability-check.ts` calls the generated render functions without
  the compiler-supplied `i18n` record, so form-colorgraph (which composes an i18n-declaring
  spinbutton) throws "Cannot destructure property 't' from null or undefined value". Found
  during LT-323 and reproduced on a clean tree. Pass `i18nRecord(tag)` (or whatever the corpus
  runner supplies) the way the build does. **Accept:** `bun run check:sim` exits 0.

- [ ] LT-328: HOST_PROFILE and compiler doc hygiene after LT-316/LT-320 (follow-up review).
  **Skill:** tech-writer
  **Context:** HOST_PROFILE § element references (the "`class`/`id` on a compose site reach
  the served DOM" invariant) must name `data-*` too, since LT-320 made it a host attribute that
  is never forwarded. It should also say that a `first()` ref's authored selector is emitted
  when verifiable (LT-316), with synthesis as the fallback. In
  `server/compiler/analysis/selectors.ts`, the `SELECTOR_GRAMMAR` constant's doc block sits
  between `matchesSelector`'s JSDoc and the function, which orphans the latter. Move the
  constant above it. The `selectorCandidates` doc also has an unwrapped over-long line.
  Docs-only; no behaviour change.

- [ ] LT-326: A server-data loop's iterable is unchecked for impure ambients — LTC033 misses a build-time shuffle (LT-313/LT-314 review).
  **Skill:** le-truc-dev
  **Context:** LTC033 runs in `lower-shared.ts` over static children and `server` attributes
  only. A server-data loop's iterable was never a node until LT-313, so it was never checked.
  Verified at review: `{[...items].sort(() => Math.random() - 0.5).map(a => <li>{a}</li>)}` and
  `{[crypto.randomUUID()].map(…)}` compile clean. That bakes one build-time shuffle into the
  page for good, which is the hazard CHECKLIST §4 names as the worst outcome. A shuffle is a
  common idiom, not a contrived probe. The iterable is always evaluated, so it takes the
  **static** (error) form, never the omit-the-reactive-form one. Check `EachForIR.iterable`
  with `containsImpureAmbient` (in the loop's outer scope, so a resolvable-locale `Intl` still
  folds). Add a loop-items builder beside `impureStaticChild`/`impureStaticAttribute`. Both
  surfaces.
  **Copy (same task):** both LTC033 builders list "`Date`/`Intl`, `Math.random()`, or a
  locale/timezone method". Since LT-314 that is incomplete: an author who writes
  `id={crypto.randomUUID()}` is told about `Math.random()`. Name the RNG generically, or list
  the `crypto` generators. Update the `diagnostics.ts` union comment and the
  `.agents/skills/le-truc/references/errors.md` row to match. In the same pass, Tech Writer
  reviews LT-313's LTC054 `where` phrase "the items of a loop" (`fold-inputs.ts`).
  **Channel:** compiler. **Tier:** 1 Prevented (existing LTC033, one new builder). **Copy
  reviewer:** Tech Writer.
  **Check:** both probes fail LTC033 on `.tsx` and `.tsrx`; a loop over an own arg and a
  resolvable-locale `Intl` iterable still compile; the corpus is unchanged.

- [ ] LT-302: Arg and setup names shadow the render-harness imports in generated server modules (LT-212 review; NOTES 2026-09-24).
  **Skill:** le-truc-dev
  **Context:** with an arg named `items`, the server module emits
  `for (const item of items(items))`, which throws `items is not a function` at render. Every
  `RUNTIME_HARNESS_EXPORTS` name is exposed the same way (`entries`, `esc`, `attr`, `cls`, …).
  The corpus avoids them by luck. **Ruling (Architect, 2026-09-24): alias, don't forbid**,
  because `items` is an ordinary arg name. Alias a harness import only when a render-scope
  name collides with it (`import { items as __items }`, and the emitter uses the alias), so every
  module without a collision stays byte-identical. Also audit the generated CLIENT module: an
  arg or setup name equal to a destructured factory-context name or an imported `@zeix/le-truc`
  export (`first`, `each`, `watch`, …) is the same hazard. If the client side can collide,
  alias there too, or diagnose if aliasing is impossible because the name is authored
  vocabulary. **Channel:** none for the aliased cases (the collision stops being an error). Any
  collision that can't be aliased is compiler, tier 1 Prevented, with Tech Writer on the copy.
  **Check:** a fixture with args `items`/`esc` renders on both surfaces; corpus output
  byte-identical; typecheck 0; warning baseline 0.
