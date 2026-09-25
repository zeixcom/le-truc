# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): wave 4 at cadence — six migrations, and the gates
they trip first.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1, P3 and P5 bands. The previous
iteration ("opening wave 4 — the last gates cleared, and the first migrations land") is fully
landed and reviewed: ADR 0039's variant sets, ADR 0040's `ForIR` split, `@empty`, LTC053,
composition across tiers, the spike fixtures rehomed, module-codeblock served as `.tsx`,
LTC054 and suite determinism. Compacted records are in `DONE.md`; the public summary is in
`CHANGELOG.md [Unreleased]`.

**Why these fifteen** (twenty-three with the addendum below). Module-codeblock proved one migration end to end. This iteration moves
the wave from proof to cadence with the six components that need nothing undesigned:
four leaves (**LT-099** pagination, **LT-101** dialog, **LT-102** splitview, **LT-103**
scrollarea) and two composites over `.tsrx` children (**LT-098** colorinfo, **LT-100** catalog).
Each migration trips a filed gate, and those gates run first. **LT-291**: every migration
retains a `.ts` twin, so the first compiled parent that references a migrated tag (codeblock
renders `<module-scrollarea>`) would import the twin. **LT-312**: the two composites are `.tsx`
parents over `.tsrx` children, the case the hand-listed typings file cannot scale to.
**LT-307**: scrollarea is the migration most likely to land Simulated, and would be the first
`.tsx`-served Simulated entry. Each migration adds a variant set, so **LT-295/LT-296** put the
variant matrix in CI and make its surface tests fail loudly instead of passing vacuously.
**LT-292** rides with LT-291 (same `compileCorpus` code). **LT-299** turns `biome check ./server`
green, so the gates the migrations cite read true. **LT-313/LT-314** are the LT-258 riders, run in
a parallel slot. LT-313 is the last gate in front of LT-257 (template emission, pioneer 2's
critical path) that does not wait on publishing.

**Addendum (2026-09-25): the migration follow-ups.** The six migrations' reviews filed defects
that sit on the components this iteration migrated, so the iteration closes them before it
exits. **LT-316** is the systemic one: the compiler swaps authored `first()` selectors for
synthesized ones, which narrows splitview's contract and widens colorinfo's. It is also the gate
for the next batch. **LT-318** (dialog's connect-time scroll jump), **LT-320**/**LT-321**/**LT-322**
(catalog: interim `data-product` fallback, missing badge site, empty `each()`) and **LT-317**
(pagination's empty pre-JS spans) fix the served components. **LT-323** brings scrollarea back
in line with ADR 0029. **LT-324** gives splitview and colorinfo the specs `test:variants` needs
to verify them at all. Left in the backlog: LT-319 (the imperative `pass(all(…))` form is
sanctioned, so the design question is low priority) and LT-325 (typings hygiene, no component
behaviour).

**Deliberately not here.** LT-104 lazyload waits on LT-303 (`truc:try`). LT-105 coloreditor and
LT-107 listnav compose the tags this iteration migrates, so they follow once LT-291 holds. LT-095
blogmeta is a contract reshape with consumer ports, and LT-106 context-media has no spec. All of
those form the next migration batch, together with LT-301 (the loop-in-branch gate) and LT-108
carousel. LT-280's grilling still waits for the iteration that implements it (it gates only
LT-109/110/111). LT-309–LT-311 (codeblock follow-through, plus two designs) wait until the
batch shows how often the root-attribute and compose-event patterns recur. The i18n chain
(LT-242 → LT-233 → LT-250), the ADR 0037 implementation (LT-274–276) and the ADR 0033 CSS track
(LT-268 → LT-304/306) do not contend with this iteration and keep for later ones.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained,
every spec green on every surface they carry, zero warnings and tier + reason recorded
(LT-098–LT-103, scrollarea's wall-time figures included); a bundle defines each migrated tag
exactly once, from the generated client, even where a compiled parent references it (LT-291);
`tsrx-imports.d.ts` is generated, not hand-written (LT-312); CI runs `test:variants`, and a
broken twin fails it (LT-295, LT-296); a stale `variantOverrides` entry is a config error
(LT-292); `bunx biome check ./server` exits 0 (LT-299); a server-data loop over `document` and a
folded `crypto.randomUUID()` both fail the build (LT-313, LT-314). The migrated components
preserve their authored contracts and match their twins' served behaviour: authored selectors
emitted (LT-316), `data-product` restored and the catalog badge server-rendered (LT-320,
LT-321), no connect-time dialog scroll (LT-318), pagination's spans filled pre-JS (LT-317), no
empty `each()` (LT-322), scrollarea not Simulated (LT-323), and splitview and colorinfo green on
both surfaces through their new specs (LT-324).

**Next free task ID: LT-326.**

---

### Migrations (leaf components first, then the two composites, then scrollarea)

- [x] LT-099: Migrate `module-pagination` to `.tsx` with same-commit cutover. — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest.
  **Done (2026-09-25):** `module-pagination.tsx` beside the retained `.ts` twin;
  `examples/main.ts` imports the generated client. The host profile gains `module-pagination`,
  `input` `min`/`max` and `aria-current`. The setup is the twin's verbatim, including its
  `asClampedInteger(min, max)` argument order. **Tier: Folded, no routing signals** (census
  22/2/0), zero warnings, CSS byte-identical to the twin's sheet.
  **Deviation:** the twin's optional `.value`/`.max` `first()` + `bindText` pairs become text
  thunks `{() => host.value}`. Rendering them from the args fired LTC039 twice (value shipped
  through the root attribute and the span). The cost: text-child thunks get no host-derived
  fold (`lazyValueExpression` renders `''`; only attribute thunks fold), so the server render
  leaves both spans empty until connect. The equivalence-audit snapshot records it. Nothing
  serves this render today (pages author the `.html` fragment; no `argsFromAttrs` without
  `i18n`). See NOTES.md.
  **Open verification:** `test:variants module-pagination` was not run, because the agent sandbox
  cannot bind a port. As a stand-in, a jsdom smoke drove the generated client and the `.ts` twin
  through init, next, ArrowRight, input clamp, `max=5` and `max=1`, with identical state. Run the
  spec on both surfaces before review.
  **Review (2026-09-25):** Approved. The text-thunk deviation stands: the empty pre-JS spans become LT-317. Moves to `DONE.md` once `test:variants module-pagination` is green.

- [x] LT-101: Migrate `module-dialog` to `.tsx` with same-commit cutover. — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. `body.scroll-lock` stays as authored until
  LT-306 makes it `:global(body.scroll-lock)`.
  **Done (2026-09-25):** `module-dialog.tsx` beside the retained `.ts` twin;
  `examples/main.ts` imports the generated client. Args are `dialogId` (LTC042's per-document id,
  which also wires `${dialogId}-title`), `title`, `label` and `children` (the content markup).
  **Tier: Folded, no routing signals** (census 23/2/0), zero warnings, CSS byte-identical to the
  twin's sheet, empty equivalence-audit connect diff. The host profile gains `dialog`, `header`,
  `h2`, `form[method]`, `aria-haspopup`, `aria-labelledby` and `module-dialog`.
  **Deviations from the twin, all setup-subset driven:** the `let scrollTop`/`activeElement` pair
  is one const `restore` record (LTC005); `SCROLL_LOCK_CLASS` moves into setup (module-scope
  consts are not client-known names, LTC005); `first('dialog button.close')` becomes
  `button.close` (no descendant combinator, LTC026 — the one `.close` in the template). The opener
  renders as a direct `<button>`, not a composed `basic-button`: a compose site cannot put
  `aria-haspopup` on the child's button.
  **Compiler change:** `discriminatorCandidates` gains a last-resort `aria-*` tail. A ref's
  query is always the synthesized selector, and without that tail the opener could only be
  addressed through an added class, which page markup lacks, so the twin's
  `button[aria-haspopup="dialog"]` contract would have broken. Tail position leaves every
  existing selector unchanged (no corpus snapshot moved). Unit-tested in `analysis.test.ts`.
  **Classified:** two jsdom notices from the connect-time close branch (`scrollTo`,
  `dialog.close`), in `sim/classifications.ts`.
  **Open verification:** `test:variants module-dialog` not run (the sandbox cannot bind a port).
  As a stand-in, a jsdom smoke over module-dialog.html (opener inside `basic-button`) passed:
  open → `showModal` + body lock, close → both undone. Run the spec on both surfaces before review.
  **Review (2026-09-25):** Approved. The `aria-*` last-resort candidate is accepted as the fallback for unauthored construct sites; LT-316 makes authored selectors the primary route. The opener as a raw `<button>` is the right boundary call. The connect-time scroll bug becomes LT-318, which also retires the two sim classifications. Moves to `DONE.md` once `test:variants module-dialog` is green.

- [x] LT-100: Migrate `module-catalog` to `.tsx` with same-commit cutover. — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. **Depends on LT-312.**
  **Done (2026-09-25):** `module-catalog.tsx` beside the retained `.ts` twin;
  `examples/main.ts` imports the generated client. Args are `title`, `cartLabel` and `products`
  (`{ id, name, note?, max }[]`, one composed `form-spinbutton` each). The cart pass is the
  `<BasicButton>` site's `truc:pass`. **Tier: Simulated** (census 25/3/0). Reason: LTC004 — the
  `total` memo feeds only the pass and has no harvestable render site. Zero warnings, CSS
  byte-identical to the twin's sheet.
  **Compiler changes:**
  - `tsrx-imports.d.ts` now gives each `.tsrx` child with Slot-backed props a `'truc:pass'` key
    over exactly those props. Without it, no `.tsx` parent could type-check a pass into a
    `.tsrx` child — the gap LT-312 left.
  - `'Promise'` added to `JS_GLOBALS` (the click handler's `Promise.all` was not client-known).
  **Deviations from the twin:**
  - `checkAvailability` moves into setup (module-scope names are not client-known).
  - `all('form-spinbutton')` is read inline: a setup const is re-declared in the server render
    (LTC046).
  - The product id falls back from `data-product` to the spinbutton's `name`: a compose-site
    `data-*` must be static, so a looped site cannot carry a per-item one. Page markup's
    `data-product` still wins. See NOTES.md.
  - The note `<small>` renders empty when a product has none (a condition over a loop item is
    LTC005).
  - `examples/tsconfig.json` includes the generated `basic-button`/`form-spinbutton` clients.
  **For review:**
  - **Server-composed catalogs never show the cart badge.** `basic-button` renders `.badge` only
    for a non-empty `badge` arg, and its client binds under a presence guard. The page-authored
    demo carries the span, so the spec's page is unaffected.
  - The loop emits an empty `each()` over a required `all('li')`. It is harmless, but a catalog
    rendered with zero products would throw `MissingElementError`.
  **Open verification:** `test:variants module-catalog` not run (the sandbox cannot bind a port).
  As a stand-in, a jsdom smoke over module-catalog.html matched the twin exactly through connect,
  increments, badge/disabled pass and the availability check. Run the spec on both surfaces.
  **Review (2026-09-25):** Approved. The generated `truc:pass` surface closes the gap LT-312 left. The `data-product` → `name` fallback is accepted **as an interim only**: it is a documented-in-comment contract extension, which HOST_PROFILE does not accept as an end state, so LT-320 restores `data-product`. Also filed: LT-321 (badge site), LT-322 (empty `each()`), LT-323 (Simulated via LTC004). Moves to `DONE.md` once `test:variants module-catalog` is green.

- [x] LT-103: Migrate `module-scrollarea` to `.tsx` with same-commit cutover. — reviewed ✓
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Has a spec. Watch for: the
  effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069
  acceptance case). **This component drove ADR 0029's three-tier shape and its tier is the thing
  to verify.** It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/
  `offsetHeight` and emits exclusively through `bindState(internals, …)`. **Expected tier:
  Folded** — the geometry reads live in scroll/observer callbacks and the
  `bindState(internals, …)` output never reaches served HTML (Static is equally acceptable; both
  are never simulated, so the ~2.3 s is unpaid either way). **Simulated is the outcome to
  investigate:** at 1,966–2,091 occurrences it reproduces the ~2.3 s ADR 0029 exists to avoid —
  either reshape the migrated component so its reads stay in client-only positions (per its
  demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier, the
  reason, and the wall-time figures either way; only wrong served HTML is a correctness bug.
  **Iteration note (2026-09-25):** the ADR 0039 migration pattern — add the `.tsx` beside the
  retained `.ts` twin (the twin declares its own `HTMLElementTagNameMap` entry), point
  `examples/main.ts` at the generated client, spec green on every surface
  (`bun run test:variants <tag>`), zero warnings, tier + reason recorded in the handoff. The
  compiled sheet stays tag-led for now; LT-306's codemod converts it with the rest. **Depends on LT-291 and LT-307** (above).
  **Done (2026-09-25):** `module-scrollarea.tsx` beside the retained `.ts` twin;
  `examples/main.ts` imports the generated client. Args are `orientation` and `children`
  (wrapped in one `<div>`, the observed child). Zero warnings, CSS byte-identical to the twin's
  sheet. Every geometry and child read sits in the scroll handler or the observer effect.
  **Tier: Simulated** (census 25/4/0) — the outcome to investigate, and investigated. **Reason:**
  LTC004 on `overflowStart`/`overflowEnd` (`createState` with no harvestable render site). The
  reads are not the cause. It is the harvest classifier's deliberate rule that a never-rendered
  eager signal routes. These two feed only `bindState(internals, …)` and the host `tabindex`
  write, both driven by layout the realm cannot answer. **Surfaced, not reshaped (NOTES.md).**
  A throwaway reshape proved a Folded outcome is reachable (census 26/3/0): hide the states in a
  holder object (`const flags = { start: createState(false), … }`) the classifier does not
  track. It only dodges the classifier, and HOST_PROFILE rules out contorting for a tier.
  **Wall time (`bun run build:docs`, simulation pass):**
  - Scrollarea Simulated: 20 occurrences across 2 locales, 474 / 341 / 330 ms over three runs.
  - Scrollarea folded (the reshape): 10 occurrences, 432 ms.
  - The difference is within noise, because realm startup dominates at demo-markup scale. The
    ~2.3 s ADR 0029 cites is a full SSG pass over ~2,091 PAGE occurrences, which today's pass
    does not run (it renders demo markup only). The cost returns if page occurrences are ever
    simulated.
  **Other deviations from the twin (setup subset):**
  - The observer helper and its ratio constants move into setup.
  - The `if (!child) return` guard moves into the observer effect, so the state watches also run
    on a childless host: false state, and they only clear `tabindex`.
  - The orientation branch moves into the scroll handler.
  **Parents:** codeblock, dialog and splitview compose it as a raw tag. They stay Folded and
  import nothing from it; `main.ts` defines the tag once, from the generated client (LT-291).
  **Open verification:** `test:variants module-scrollarea` not run (the sandbox cannot bind a
  port). As a stand-in, a jsdom smoke with a stubbed `IntersectionObserver` over the demo markup
  matched the twin exactly (observer count, overflow → `tabindex="0"`, fit → removed, disconnect
  cleanup). Scroll geometry is unverifiable in jsdom. Run the spec on both surfaces.
  **Review (2026-09-25):** Approved, including the choice to surface rather than reshape: the holder-object trick would have contorted the component around a classifier gap. The Simulated tier is an implementation gap against ADR 0029, not a component defect, and becomes LT-323. The wall-time figures stand as recorded. Moves to `DONE.md` once `test:variants module-scrollarea` is green.

### Migration follow-ups — defects in this iteration's migrated components

- [ ] LT-316: Emit the authored `first()` selector when it is structurally verifiable (LT-098–LT-103 review). **Gate: before the next migration batch.**
  **Skill:** le-truc-dev
  **Context:** A ref's query is always `resolveSelectorIn`'s synthesized selector
  (`analysis/effects.ts`, the `addQuery(refAttr.name, selector, …)` in `emitTopEffects`). The
  authored selector is only used to find the template element. Page-authored occurrences are
  addressed by the authored selector's contract, so the rewrite changes behaviour:
  - splitview: `button.divider` → `button[role="separator"]`. A divider without the role now
    throws, and the message still names `button.divider`.
  - colorinfo: `.hex` → `small`. This is wider and can bind the wrong `<small>`.
  - dialog: only LT-101's `aria-*` tail saved the contract.
  **Rule:** emit the authored selector when it (a) parses in `matchesSelector`'s grammar,
  (b) is structurally unique over the own template, and (c) survives the LT-096 composed-shapes
  check (else append the `:not(<child-tag> *)` exclusion, as for synthesized candidates). Fall
  back to synthesis only when it fails. LT-101's `aria-*` tail stays as the fallback for
  unauthored construct sites.
  **Accept:** the corpus's generated clients change only where the two differed. List each
  changed query in the handoff, and move snapshots only for those.

- [ ] LT-318: module-dialog restores scroll and focus only after an actual open, on both surfaces (NOTES LT-101).
  **Skill:** le-truc-dev
  **Context:** The `open` watcher's close branch also runs on the initial `open = false`. It
  calls `window.scrollTo({ top: 0 })`, so a dialog connected after load (lazy content, a DOM
  move) jumps the page to the top, and it calls `dialog.close()` on a dialog that was never
  opened. Fix both the `.ts` twin and the `.tsx` source identically: a `restore.opened` flag set
  in the open branch gates the close branch's restore.
  **Retire** the two `module-dialog` entries in `server/compiler/sim/classifications.ts`
  (`scrollTo`, `dialog.close`), because the connect-time branch no longer runs. The baseline test
  then proves the fix.
  **Accept:** the module-dialog spec gains a leg: scroll the page, connect a dialog, assert the
  scroll position is unchanged.

- [ ] LT-320: Render-only `data-*` on compose sites may be dynamic; restore module-catalog's `data-product` (NOTES LT-100).
  **Skill:** le-truc-dev
  **Context:** A compose site's `class`/`id`/`data-*` splice onto the child's root only when
  static (LT-090), because they double as addressing discriminators. A per-item
  `data-product={product.id}` inside `products.map` is instead passed to the child's render as
  an unknown arg and dropped. **Rule:** a dynamic `data-*` on a compose site renders through
  `composeHostAttrs` with its server expression but is never a discriminator candidate (the
  synthesizer already skips non-static values). Then restore module-catalog's `data-product` on
  its looped `<FormSpinbutton>`. Drop the `?? item.getAttribute('name')` fallback, which extended
  the contract and was accepted only as an interim (HOST_PROFILE: migrations preserve the
  contract).
  **Accept:** the catalog's server render carries `data-product` per item. The `.tsx`
  `ComposeSiteAttrs` type already admits it.

- [ ] LT-321: basic-button always renders its badge site, so a passed badge has somewhere to land (NOTES LT-100).
  **Skill:** le-truc-dev
  **Context:** `basic-button.tsrx` renders `span.badge` only under `@if (badge)`, and its client
  binds the optional ref under a presence guard. A parent that composes the button with an empty
  badge and drives it by `truc:pass` (module-catalog's cart count) never shows the count on a
  server-rendered page. Render the span unconditionally and hide it when empty (CSS
  `.badge:empty { display: none }`, or `hidden` bound to emptiness), in the same shape as the
  twin's demo markup.
  **Accept:** the basic-button spec still passes; a catalog server render shows the badge after
  an increment.

- [ ] LT-322: A loop whose body has no client constructs emits no `each()` (NOTES LT-100).
  **Skill:** le-truc-dev
  **Context:** module-catalog's `products.map(…)` compiles to an empty
  `each(all('li', 'module-catalog: li missing'), product => {})`. The required `all()` makes a
  zero-product catalog throw `MissingElementError` for nothing. Skip both the query and the
  `each()` when the planned body is empty.
  **Accept:** module-catalog's generated client has no `li` query. Corpus snapshots move only
  where an empty `each()` was emitted.

- [ ] LT-317: Fold text-child `host.<prop>` thunks server-side, as attribute thunks already are (NOTES LT-099).
  **Skill:** le-truc-dev
  **Context:** `emit-server.ts`'s `lazyValueExpression` renders `''` for any lazy child reading
  `host`, while the `reactive` attribute case tries `hostPropMirrorExpr`, then
  `hostDerivedExpr`. So a Parser-exposed prop has no clean text-site spelling: rendering it from
  the arg warns (LTC039), and the thunk renders empty. module-pagination's `.value`/`.max` spans
  ship empty before JS.
  **Change:** route arrow-thunk lazy children through the same two folds before the `''`
  fallback. Tier classification is unaffected (a fold only fills a site that already folds
  Folded).
  **Accept:** pagination's equivalence-audit connect diff for the two spans becomes empty. The
  snapshot moves are listed and none widens a diff.

- [ ] LT-323: A signal whose consumers are all client-only does not route Simulated — ADR 0029 conformance (NOTES LT-103). **Gate: before any pass simulates page occurrences.**
  **Skill:** le-truc-dev
  **Context:** ADR 0029 names module-scrollarea as the component that must never be simulated,
  and says components whose reads sit in client-only positions fold. The migrated scrollarea
  routes Simulated anyway. Its `createState(false)` flags have no render site, and
  `harvest.ts`'s `substituteArgExpr` rule treats every never-rendered eager signal as LTC004
  drift. module-catalog's `total` memo routes for the same reason (its only consumer is a
  `truc:pass`). This is an implementation gap against an accepted ADR, not new design.
  **Rule:** a signal none of whose consumers can reach served HTML — every read inside
  `watch()`/`on()` callbacks, `bindState(internals, …)`, a `truc:pass`/`pass()` thunk, or host
  writes of stubbed-API values — is not an LTC004 routing signal.
  **Accept:** scrollarea classifies Folded or Static (either is fine; record which), and the
  tier-corpus map moves it. LT-103's throwaway holder-object reshape showed that the classifier
  is the only obstacle. Today's cost is noise (demo markup only: 474 / 341 / 330 ms Simulated vs
  432 ms folded). The ~2.3 s returns the moment page occurrences are simulated, hence the gate.

- [ ] LT-324: Write the missing specs for module-splitview and module-colorinfo.
  **Skill:** le-truc-dev
  **Context:** Both migrated with no `<tag>.spec.ts`, so `test:variants` never runs them on
  either surface. Their only verification is a jsdom smoke. Cover:
  - splitview: keyboard steps, Home/End, the preset `split`, vertical orientation, and pointer
    drag (which jsdom cannot test).
  - colorinfo: the connect state from `value`, a `value` write updating all six `basic-number`s,
    and the label harvest.

### Parallel slot — the LT-258 riders

- [x] LT-313: Check a server-data `@for`'s iterable against the partial-readiness invariant (LT-258 review). **Gate: before LT-257.** — done, pending review ⏳ (Tech Writer: review the LTC054 `where` phrase "the items of a loop", `fold-inputs.ts`)
  **Skill:** le-truc-dev
  **Context:** LT-258's `checkFoldInputs` covers every server-evaluated position except one:
  the iterable of a server-data loop, because `EachForIR` carries only `iterableText`, not a
  node. Verified at review: `{[...document.querySelectorAll('a')].map(a => <li>{a.href}</li>)}`
  compiles clean and classifies Folded, so the loop's item set is the build page's DOM. Add the
  iterable's `AstNode` to `EachForIR`, populated by both front ends. Adding an IR field before
  first publish is free under ADR 0034 s8 and ADR 0040, and the task has to land before LT-254
  anyway. Then check it in `checkFoldInputs` as an always-evaluated position. **Channel:**
  compiler. **Tier:** 1 Prevented. It reuses LTC054, so no new copy is needed beyond the
  `where` phrase (e.g. "the items of a loop"). Tech Writer reviews that phrase.
  **Check:** the probe above fails with LTC054 on both surfaces; the corpus is unchanged.

- [x] LT-314: `crypto.randomUUID()`/`getRandomValues()` fold silently — close the impure-ambient gap (LT-258 review). — done, pending review ⏳
  **Skill:** le-truc-dev
  **Context:** `impureAmbientCauses` (`evaluability.ts`) flags `Math.random()` as `rng` but
  not `crypto`, which sits in `JS_GLOBALS`. Verified at review: `<span id={crypto.randomUUID()}>`
  compiles clean and classifies Folded, which bakes one build-time random id into the page. That
  is exactly the hazard LTC033 exists for. Add `crypto.randomUUID`/`crypto.getRandomValues` to
  the `rng` cause, so static positions get LTC033 and reactive ones are omitted, following the
  existing precedent. This is not the partial-readiness invariant: the RNG is unresolvable, not
  page context. **Channel:** compiler. **Tier:** 1 Prevented (existing LTC033, whose copy
  already names "a random id").
  **Check:** the probe errors LTC033 in a static position and omits in a reactive one; the
  corpus is unchanged.
