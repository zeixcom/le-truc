# DONE

Done-and-reviewed tasks since the last release, compacted per the 3-file mini-kanban (owner,
2026-09-18). Each entry keeps only what is still load-bearing: rulings recorded nowhere else,
live handoffs into open tasks (referenced by LT-ID), and the changed-artifact facts Changelog
Keeper needs at release planning. Verification transcripts, changed-file line inventories and
review narratives are dropped — the full record stays in `git log -p`. Entries still carrying
`— done, pending review ⏳` are finished but not yet reviewed; their review pass happens in a
future iteration. At release planning Changelog Keeper consumes this file alongside
`CHANGELOG.md [Unreleased]`; the Architect then prunes entries whose context no live task needs.

---

Pruned 2026-09-25, second pass (Architect, after the "wave 4 at cadence" iteration closed;
Changelog Keeper had already merged it into `CHANGELOG.md [Unreleased]`). Consumed with nothing
left to carry: **LT-098, LT-100, LT-292, LT-299, LT-307, LT-313, LT-317, LT-318, LT-321, LT-322,
LT-324, LT-327**. Every live handoff they carried is restated in its own open entry: LT-319
(LT-098's sanctioned imperative `pass(all(…))`), LT-325, LT-326, LT-328, LT-330. LT-292's
"`variantSurface` with no set present is not an error" ruling is pinned by a test. The
migration rulings of LT-099, LT-101–LT-103 and LT-291 are condensed into the standing notes
below. Earlier prunes: 2026-09-25 (the "opening wave 4" iteration: LT-235, LT-237, LT-238,
LT-283–LT-286, LT-293, LT-294, LT-298, LT-315), 2026-09-21 ×2. Full entry text:
`git log -p -- DONE.md`.

**Standing notes for compiler-adjacent tasks:**
- A compiler crash during a corpus build makes `typecheck`'s `&&`-chained `tsc` silently skip.
  Check the exit code, never grep for "error TS" (LT-226 review).
- A handoff's `check:corpus` claim is its **exit code**, not the warning baseline (LT-283
  review, after a "green" gate turned out to be exit 2).

**Standing notes for wave-4 migrations** (rulings recorded nowhere else):
- **Don't contort a component to dodge a classifier gap; file the gap** (LT-103: the
  holder-object reshape was rejected). Record the tier and reason as they land.
- **A Parser-exposed prop's text site is a `{() => host.<prop>}` thunk**, not the arg. The arg
  spelling duplicates the channel (LTC039), and the thunk folds server-side since LT-317 (LT-099).
- **A client that writes a style or ARIA value at connect gets a server render in the exact form
  the watcher writes**, so the connect diff is empty (LT-102, splitview's ratio and divider ARIA).
- **A compose site cannot put attributes on the child's inner element**, so an opener needing
  `aria-haspopup` renders as a raw `<button>`, not a composed `basic-button` (LT-101). The
  dialog's `body.scroll-lock` waits for LT-306's `:global()`.
- **A raw dashed tag seeds a child import only when a query addresses it** (a `first()` ref or
  a `truc:pass` target). A bare `<module-scrollarea>` with no binding imports nothing and is
  registered by `main.ts`. Type visibility rides the same import, ADR 0039 s4 (LT-291).
- **Scrollarea's wall-time at demo scale is noise** (474/341/330 ms Simulated vs 432 ms Folded).
  The ~2.3 s ADR 0029 cites returns only once page occurrences are simulated (LT-103).

- [x] LT-326: A server-data loop's iterable is unchecked for impure ambients — reviewed ✓
  **Changed:** a server-data loop whose items read `Date`/`Intl`, an RNG (`Math.random()`,
  `crypto.randomUUID()`/`getRandomValues()`) or a locale method fails **LTC033** on both
  surfaces (new `impureLoopItems` builder; copy reviewed by Tech Writer). The check sits in
  `fold-inputs.ts`, the one walk that holds the loop's outer scope, so a resolvable-locale
  `Intl` iterable still folds. All LTC033 copy now names the RNG generically.
  **Review:** approved 2026-09-25. LTC033 is still syntactic at the site on every position,
  so a setup const, a helper or a hoisted loop const that carries the impure read compiles
  clean. **Live handoff:** LT-340.

- [x] LT-302: Arg and setup names shadow the render-harness imports — done ✓
  **Changed:** generated modules alias a colliding name instead of failing (Architect ruling
  2026-09-24: alias, don't forbid). Server: an emitter-synthesized harness import
  (`items`, `esc`, `attr`, …) is imported as `__<name>` when a param, setup, loop or catch
  binding shares its name. Client: the same for `@zeix/le-truc` imports (`as __x`) and
  factory-context members (`x: __x`), after the audit found a setup `const bindText`
  shadowing the synthesized `bindText(span)`.
  **Ruling (recorded nowhere else):** only emitter-synthesized sites are aliased. Authored
  text keeps its spelling, because inside the factory the author's name already means the
  author's binding. `host`/`internals` are never aliased: an authored `host` const is the
  author's own shadow. No diagnostic was needed.

- [x] LT-330: `@case` tests are render positions — done ✓
  **Changed:** switch cases carry their test node in the IR (`test: AstNode | null`), and
  the test is credited as a render position, collected for server imports and checked for
  page context (LTC054) beside the discriminant. A `@case` test over a
  context-member-seeded signal now routes Simulated (LTC004) on both surfaces.

- [x] LT-329: `check:sim` fails on a clean tree — done ✓
  **Changed:** `scripts/sim-portability-check.ts` passes `i18nRecord(component)` to the
  render function, as the build does. Bun and Node serialize identically.
  **Open caveat:** Deno was not verified: the agent sandbox blocks its npm cache. The
  exit-0 criterion stands once the owner runs `bun run check:sim` locally.

- [x] LT-328: HOST_PROFILE and compiler doc hygiene after LT-316/LT-320 — done ✓
  **Changed:** HOST_PROFILE § element references names `data-*` in the compose-site
  invariant (a host attribute, never forwarded; literals only), and says the authored
  `first()` selector is emitted when verifiable, with synthesis as the fallback.

- [x] LT-107: Migrate `module-listnav` to `.tsx` with same-commit cutover — reviewed ✓
  **Changed:** serves as compiled `.tsx`, twin retained. **Tier: Simulated** (`compose-read` of
  the Simulated `form-listbox`, as predicted). Composes `FormListbox` and `ModuleLazyload`; the
  twin's `pass()` is `truc:pass` on the lazyload site, so `module-lazyload.tsx`'s args declare
  `'truc:pass'?: { src?: () => string }`. Initial hash sync stays in effect activation (LT-200).
  Hash helpers live in `listnav-hash.ts` as pure functions of the first option's value, shared by
  both members and `module-listnav.test.ts`. Compiler: `JS_GLOBALS` gains `location`/`history`
  (already `PAGE_CONTEXT_GLOBALS`, so a server fold over them still fails LTC054).
  **Review:** code approved 2026-09-25; accepted once LT-332 landed its spec.

- [x] LT-332: The docs' Markdoc `listnav` options no longer match the compiled form-listbox contract — reviewed ✓
  **Changed:** `listnav.markdoc.ts` emits `data-value`/`data-label` (no `value`) on option
  buttons. **Public API:** form-listbox exposes read-only `options: FormListboxOption[]`, the
  unfiltered projection of its option buttons; `visibleOptions` is now `options` filtered. Both
  module-listnav members read `listbox.options` instead of querying its markup. `getBasePath`
  accepts `../` values (the locale-tree docs rewrite), which had silently disabled hash sync on
  `docs/en/examples.html`. New `module-listnav.spec.ts`; `test:variants form-listbox
  module-listnav` passes (owner, 2026-09-25).
  **Ruling (Architect, 2026-09-25):** the sim realm stubs `history` inert and forced
  (`patch-table.ts` shape `history`, mirrored in `capabilities.ts`), not a standing
  `CLASSIFIED_DIAGNOSTICS` entry. A build has no session history, which is the same reason
  `requestAnimationFrame` is stubbed; a classification would record a throw on every simulated
  listnav render forever. The classifier mirror adds no new routing: `history` is already in
  `PAGE_CONTEXT_GLOBALS`, so a served read of it is LTC054 before tiering sees it.
  Reusable rule: a connect-time page-context API the realm lacks gets an inert stub, not a
  classification.

- [x] LT-104: Migrate `module-lazyload` to `.tsx` with same-commit cutover — reviewed ✓
  **Changed:** serves as compiled `.tsx`, twin retained. **Tier: Simulated** (LTC043: `setHTML`
  reads the `contentEl` ref in setup, consumed only by a `watch`). The client factory now
  destructures a context member that only setup declarations read (`host` in the task callback;
  `analysis/plan.ts`, `client-context-members.test.ts`). A sim classification records the demo's
  intentional missing-`card-callout` instance.
  **Rulings (owner/Architect, 2026-09-25):** lazyload keeps the twin's hand-written
  `watch(content, { ok, nil, stale, err })`. The compiled boundary cannot express this contract.
  **Live handoffs:** the `<truc:try>` spelling is LT-334, the over-routing LT-333, and the
  destructuring diagnostic LT-337.

- [x] LT-105: Migrate `module-coloreditor` to `.tsx` with same-commit cutover — reviewed ✓
  **Changed:** serves as compiled `.tsx`, twin retained. **Tier: Folded.** Composes
  `CardColorscale`, `FormColorgraph`, `FormTextbox` (typed through LT-325's generated `.tsrx`
  entries) and nine `ModuleColorinfo` sites, each with its own class and `truc:pass`. The twin's
  loops are unrolled. It server-renders the textbox value and description and every step's label
  and color. `module-colorinfo.tsx` gains an additive `open = true` arg. New spec
  `module-coloreditor.spec.ts` (12 tests, written against the twin). `test:variants` passes.
  **Live handoffs:** the canvas-notice attribution leak is LT-335, whose fix retires the colorinfo
  classification in `sim/classifications.ts`.

- [x] LT-106: Migrate `context-media` to `.tsx` with same-commit cutover — reviewed ✓
  **Changed:** serves as compiled `.tsx`, twin retained, setup verbatim. **Tier: Folded.** The
  context keys and types move to the side-effect-free `media-contexts.ts`. The twin re-exports
  them, so its public exports are unchanged, and `card-mediaqueries.tsrx` imports from there, so
  the bundle defines `context-media` once. Compiler: an `import type` named only by carried
  declarations is placed in those modules instead of being dropped with LTC014 (`imports.ts`,
  `type-import-placement.test.ts`). `JS_GLOBALS` gains `Map`/`Set`/`WeakMap`/`WeakSet`. New spec
  `context-media.spec.ts` (10 tests).
  **Ruling (Architect, 2026-09-25):** a provider's context keys live in a module with no side
  effects, never in the component module, because importing a component module defines the
  element. **Live handoff:** the docs snippet and the rule are LT-189 item 14.

- [x] LT-108: Migrate `module-carousel` to `.tsx` with same-commit cutover — reviewed ✓
  **Changed:** serves as compiled `.tsx`, twin retained. **Tier: Simulated** (three LTC013
  signals on the `all()`-bound consts, whose consumers are client-only). Both loops render static
  seeds only. Setup keeps the twin's two `each()` blocks and the observer effect. Compiler fixes:
  `.tsx` `for` initializers keep their declaration (`to-estree.ts`); the client destructure
  collects `all`/`first` read only by plain consts; `JS_GLOBALS` gains `IntersectionObserver`.
  **Ruling (Architect, 2026-09-25):** a helper called directly in an `each()` callback is exempt
  from LTC045, because `each()` runs the callback in its own collector. A function nested inside
  that callback is still deferred. **Live handoffs:** the over-routing is LT-333, and the LTC046
  wording LT-189 item 13.

- [x] LT-319: One `truc:pass` spelling for several same-discriminator compose sites (NOTES LT-098) — reviewed ✓
  **Changed:** sites that share a class, have no unique `class`/`id`/`data-*` of their own and no
  author `first()`, and carry textually identical `truc:pass` objects (same prop set,
  whitespace-collapsed thunk text) lower to **one** `pass(all('<tag>.<class>'), …)`. The query is
  named `${tag}s`, the loop convention, and the LTC012 legality checks run once. A differing or
  mixed group is LTC007, whose compose text is rewritten to name both fixes. colorinfo's six
  `BasicNumber` sites use `truc:pass`, and its imperative `pass(all(…))` block is gone; the `.ts`
  twin keeps it. HOST_PROFILE describes the shared query. `test:variants` passes for colorinfo
  and coloreditor.
  **Rulings (owner/Architect, 2026-09-25):** textual identity only, never semantic equivalence.
  The shared `all()` queries are required, as LT-338 ruled for auto-addressed sites. The
  imperative `pass(all(…))` stays sanctioned as a client-only setup statement (tier 2).
  **Changelog:** new capability; LTC007 message change.

- [x] LT-339: A shared `truc:pass` group must not include a site that has its own unique discriminator (LT-319 review) — reviewed ✓
  **Changed:** `composeSharedPassClause` admits a group only when every member would reach the
  fallback itself: no `ref` attr and no unique clause of its own. Before the fix, a member with a
  unique `id` swallowed the group's one emission, so another site compiled with no `pass` and no
  diagnostic, or the member was passed twice. That case is now LTC007. Folded into LT-319 for the
  changelog: it never shipped.

- [x] LT-338: Auto-address composed `truc:pass` sites — retire LTC012's "needs a `first()` reference" rule — reviewed ✓
  **Changed:** a composed `truc:pass` site needs no `first()`. The compiler addresses it by the
  child tag plus its unique static `class`/`id`/`data-*` and names the query after the tag
  (`moduleColorinfo`, `moduleColorinfo2`, …). An author `first()` still names the query and
  carries its reason text. The LTC012 message `composedPassRequiresRef` is **retired**; LTC012
  keeps its other four rows. coloreditor drops eleven unread references and listnav one.
  HOST_PROFILE, `errors.md` and the compiler comments are updated.
  **Rulings (Architect, 2026-09-25; recorded nowhere else):** an auto-addressed site is a
  **required** query (`'one'`, default `<tag>: <selector> missing` message), the same as a raw
  custom element. coloreditor's nine formerly reason-less, and so optional, `colorinfo`
  references lose their `if (el)` guards on purpose: the template renders those sites. The
  rule dates from `ref={}` and outlived its reason once LT-090/LT-320 made the attribute
  pass-through an invariant. **Changelog:** a user-visible diagnostic removal.

- [x] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision) — reviewed ✓
  **Changed:** `basic-blogmeta.tsx` serves; the `.ts` twin stays. Props `author?`, `avatar?`,
  `published?`, `modified?`, `readingTime?` (the `reading-time` attribute), all schema.org
  microdata re-emitted. The page renderer (LT-194) expands attribute-only occurrences: the
  examples fragments (own `lang`), `card-blogpost.html`, `pages.ts` cards and archive, and
  `blog.html`. `applyTemplate` now renders the layout's own occurrences after variable
  substitution. Four `i18n` keys, with first-draft translations in all six catalogs. **Folded:
  LT-173's deferred fold verification is done** (`Date.UTC` + `timeZone: 'UTC'` in the page
  locale, plus a days-in-month guard because `Date.UTC` rolls over).
  **Rulings (Architect, 2026-09-25; recorded nowhere else):** a server arg's page-occurrence
  attribute is its **kebab-case** name, and a `number` arg has a numeric channel (blank =
  absent, non-numeric = unrenderable). An optional `author` is accepted (archive entries are
  date-only). **`bun run build:docs` is part of every migration's check**: it caught LT-104's
  demo regression, which nothing else ran. The translations stand until the owner's translator
  pass. **Live handoffs:** LT-336 (spinbutton `bigStep` residue, convention docs).

- [x] LT-301: Loops in conditional contexts are mis-addressed on the client — diagnose them — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** a loop whose output is a direct root of an `if`/`switch` branch is LTC005 on
  both surfaces (`reportLoopsInBranches`, `validate-lowered.ts`; new builder
  `diagnostic.loopInBranch`, per-surface fix). An authored `hidden`/`data-unreconciled` on a
  reactive-List `@empty` root is LTC005 (`validateEmptyArm`). Corpus output byte-identical.
  **Ruling (Architect, 2026-09-25; recorded nowhere else):** the developer's narrowing is
  confirmed. The 2026-09-24 ruling's "nearest control-flow ancestor" means the loop output IS a
  branch root (fragments flatten, so the `.tsx` fragment arm is the same shape). A loop wrapped
  in an element inside a branch stays legal: the wrapper is the branch root, and a client
  construct inside it is already LTC005 from `analysis/effects.ts`. The `sync` parity fixture
  pins the legal wrapped shape. Branch-scoped `each()` stays deferred until a migration needs
  it, and then it is a design task.

- [x] LT-300: Review the three LTC005 phrases LT-212 added — reviewed ✓
  **Skill:** tech-writer
  **Changed:** `diagnostic.unsupported` ends "… is outside the supported subset (ADR 0023)."
  plus an optional `fix` sentence, replacing the stale "sanctioned milestone-2 … Supported:"
  list on every LTC005 message (user-visible). The three LT-212 sites and LT-301's rider pass
  a fix; `@empty` is backticked. **Live handoff:** LT-189 item 12 (the `errors.md` row, the
  CHANGELOG line, and moving other call sites' inline fixes into `fix`).

- [x] LT-325: Generate `.tsrx` tag-map typings instead of hand-listing generated clients in `examples/tsconfig.json` — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `tsrx-imports.d.ts` also carries an `HTMLElementTagNameMap` entry for every
  tag SERVED from `.tsrx` (host `HTMLElement` or `FormAssociatedElement`, intersected with
  the client's `<Name>Props`); `examples/tsconfig.json` hand-lists no generated client.
  **Ruling (recorded nowhere else):** a `.tsx`-served tag gets no generated entry — its
  authored source carries one under a different props symbol, so a second copy would be a
  TS 2717 mismatch. The generated entry is identical to the client's own and merges with it
  in the root program.

- [x] LT-303: `<truc:try pending catch>` replaces `boundary()` and the try/catch IIFE in `.tsx` (ADR 0041) — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `.tsx` authors both boundaries as `<truc:try catch={e => …}>content</truc:try>`,
  and adding `pending={…}` makes it the async boundary. `host-profile.d.ts` drops the `boundary`
  declaration and adds `IntrinsicElements['truc:try']`, plus a global
  `JSX.ElementChildrenAttribute`. Both surfaces lower onto the unchanged `try` IR. The
  async and sync fixtures now have `.tsrx` twins, and a parity test pins their server
  modules byte-for-byte.
  **Rulings:** `tsc` owns the arm types, a repeated arm (TS17001) and the missing `catch`.
  The compiler keeps one shape error (LTC005, compiler channel, tier 1): arms written
  inline, `catch` an arrow with a JSX body, no other attributes. It also guards the missing
  `catch`, because the compiler never runs `tsc`. `<truc:try>` is recognized in child
  position and as a ternary or `&&` arm. As a `.map()` output root it stays LTC053, the same
  as `.tsrx`, which rejects `@try` as a loop body root.
  **Review:** Approved. The global `ElementChildrenAttribute` regresses compose sites whose
  child takes `children?: string` → **LT-331**. Diagnostic copy, including the misleading
  LTC053 wording for a loop root, goes to BACKLOG P1 Tech Writer batch item 5.

- [x] LT-323: A signal whose consumers are all client-only does not route Simulated — ADR 0029 conformance — reviewed ✓
  **Ruling (recorded nowhere else):** the credit is "at least one client-only read, none a
  render read", not "every consumer client-only". A literal-initializer signal is sound either
  way, because the client reuses the initializer the server rendered from. Since LT-327 the
  render read is transitive through setup consts. **Live handoff:** LT-330 (`@case` tests).

- [x] LT-316: Emit the authored `first()` selector when it is structurally verifiable — reviewed ✓
  **Ruling (recorded nowhere else):** where a composed child could match, the authored selector
  gets the `:not(<child> *)` exclusion instead of losing to a clean synthesized candidate. The
  exclusion only narrows the contract to the component's own markup. **Live handoff:** LT-328.

- [x] LT-320: Render-only `data-*` on compose sites may be dynamic — reviewed ✓
  **Ruling (recorded nowhere else):** compose-site `data-*` is a host attribute, never a server
  arg. Only literals are discriminator candidates. A child wanting a `data-*` server arg needs a
  new design, not a carve-out. **Live handoff:** LT-328.

- [x] LT-314: `crypto.randomUUID()`/`getRandomValues()` are impure ambients — reviewed ✓
  **Accepted residue (recorded nowhere else):** computed or aliased receivers
  (`crypto['randomUUID']()`, `const { randomUUID } = crypto`) still fold, as they already did
  for `Math.random`. Revisit only on a real case. RNG stays on the impure-ambient side of the
  LT-258 split, not `PAGE_CONTEXT_GLOBALS`.

- [x] LT-312: Generate the `.tsx` → `.tsrx` compose-import typings — reviewed ✓
  **Rulings (recorded nowhere else), for LT-325:** keys are the shortest path suffix no other
  listed source shares, so a collision is a loud "cannot find module", never a silent mistype. A
  variant set's unserved `.tsrx` member is listed too, typed through the served module. The file
  is always written, even empty, so the tsconfig include never dangles. It needs a corpus build
  first: `typecheck.test.ts`'s examples leg relies on CI building the corpus before `test:server`.

- [x] LT-296: Surface-route hardening — reviewed ✓
  **Ruling (recorded nowhere else):** the canonical output directory is deliberately NOT pruned.
  The route serves a canonical client only when `registry.json` selects that surface, so a stale
  canonical file cannot 200. Only `variants/` is owned and pruned by `compileCorpus`.

- [x] LT-295: Run the variant spec matrix in CI (ADR 0039 s2) — reviewed ✓
  **Open verification (recorded nowhere else):** CI triggers only on pushes and PRs to
  `main`/`next`, not on `v3`, so the first CI proof is the next PR's run. It must list every
  variant set (eleven since LT-098–LT-103), and a throwaway broken `.ts` twin must fail the job on
  surface "ts".

- [x] LT-207: Stop the simulation realm's dependency-wait timers from leaking past teardown — reviewed ✓
  **Ruling (recorded nowhere else):** timer ownership is process-wide, not realm-scoped — ANY
  host timer scheduled while a realm is open is cancelled at `dispose()`. That is safe because
  `build.ts` runs `simulateCorpus()` only for one-shot builds. A future task that opens a realm
  inside a long-lived process (dev server, watch rebuilds) must revisit this.

- [x] LT-258: Make the partial-readiness invariant a compiler check (LTC054) — reviewed ✓
  **Rulings (Architect, 2026-09-25; recorded nowhere else):**
  - **A folded reactive thunk that reads page context is an error, not an omission.** LTC033's
    omit-the-reactive-form precedent does not transfer: `Date.now()` is *unresolvable* (no tier
    has an answer), while a page-context read is *realm-answerable*, so omitting it would
    silently re-route the component Folded → Simulated and out of template emission (ADR 0035
    s2) — the quiet foreclosure ADR 0034 s4 exists to prevent. A thunk only errors when the
    server would actually fold it.
  - **The page-context side is an explicit deny-list** (`PAGE_CONTEXT_GLOBALS` in
    `server/compiler/fold-inputs.ts`); the positive side is closed by `assertFoldScopeClosed`.
    Together they make the invariant checkable without a pure-globals allow-list over
    `JS_GLOBALS`. LT-313 and LT-314 extend this, and must keep that split.

- [x] LT-096: Migrate `module-codeblock` to `.tsx` with same-commit cutover — reviewed ✓
  **For the next migrations:** the tier prediction was wrong (predicted Simulated, landed
  **Folded, no routing signals**): refs used only in `watch`/`on` never route. The compiler now
  emits `base:not(<child-tag> *)` for a synthesized selector that a composed child's markup
  could match; `ElementFromSelector` ignores pseudo-class arguments.
  **Rulings (2026-09-25):** the `:not(<tag> *)` exclusion is accepted — its only miss is an own
  element inside a same-tag ancestor of the host, which no composition produces. **No
  compiler-stamped hash class for addressing:** the component's occurrences are page-authored
  (fence schema, tab fragments) and never pass through the compiler's render, so a stamped hook
  would be absent exactly where the enhancer must bind, and it would put a compiler-versioned
  token into the hand-authoring contract (the move ADR 0033 declined for styles).
  **Live handoffs:** LT-309, LT-310, LT-311, LT-312.

- [x] LT-212: `@for`'s `@empty` arm, on both surfaces and both loop paths — reviewed ✓
  **Ruling (owner, 2026-09-24):** `.tsx` pays the cost too (ADR 0032 s6, no exception) — the
  empty-state idiom is recognized by shape, and its test is never evaluated as an `if`
  condition, which is what lets it cover a reactive List. The IR shape is ADR 0040 s1's.
  **Open obligation:** no browser run of the reactive-List toggle exists, because no corpus
  component uses `@empty` yet. **The first migration that does owes a spec leg for the
  empty → filled → empty cycle.** Live handoffs: LT-300, LT-301, LT-302.

- [x] LT-213: Dynamic `<{expression}>` tags — reject on both surfaces (LTC053, scope A0) — reviewed ✓
  **Ruling (owner, 2026-09-24):** reject now. [ADR 0041](adr/0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)
  records `<truc:element tag={…}>` (server-known HTML element names only), built when a migration
  needs it. **Recorded only here, for that task:** `first()`/CSS address such an element by
  class/id/`data-*`, never by tag; `.tsx` does not use React's `const Tag = …; <Tag>` (collides
  with PascalCase compose dispatch); the IR shape is `tag: { kind: 'static', name } |
  { kind: 'server', exprText }`. Live handoff: LT-303 exempts `truc:try` from LTC053 (recorded
  there).

- [x] LT-188: Load the composed-children closure before the simulation pass renders — reviewed ✓
  **Ruling (recorded nowhere else):** a Folded/Static child in the closure now runs its connect
  inside the realm, so its diagnostics land in the build report attributed to the rendering
  parent. That is intended (it is what the browser runs) and gated like any other entry.

- [x] LT-266: Measure the size bet — reviewed ✓
  **Ruling (recorded nowhere else):** the bet holds, and the margin is the **runtime, not the
  payload** (8.72 vs 64.38 kB gzip runtime; the payload line, 3.07 vs 8.54, favours React and
  never flips). **Any connector claim quotes BOTH lines.** Run of record:
  `spike/size-bet/FINDING.md`. It is the REQUIREMENTS §1 acceptance number for any future
  hydration-blob proposal.

- [x] LT-290: `argsFromAttrs` re-emits Parser fallbacks that read `first()` refs out of scope — done ✓
  **Ruling (recorded nowhere else):** declaring the ref stub inside the page-occurrence helper
  was rejected, because a `refStub` value would reach the markup (§ 8). Live handoff: LT-297.

- [x] LT-179: Remove the explicit factory return contract and `forEachUnseen` — reviewed ✓
  **Trap (recorded nowhere else):** one `src/tests/reactive.test.ts` assertion is worded to pass
  under either the pre- or post-LT-178 spelling. Tightening it is free once the LT-178 copy
  rider (LT-189 item 11) settles the final wording.
