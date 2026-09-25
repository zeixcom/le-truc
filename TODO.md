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

**Order.** LT-303 → LT-104 → LT-107 (listnav composes lazyload). LT-325 before LT-105 and LT-107.
LT-301 and LT-300 before any migration that meets a loop inside a branch; none is expected.
LT-095, LT-106 and LT-108 are ungated and can start at once. LT-105 and LT-106 write their spec
against the `.ts` twin before migrating (LT-324 precedent).

**Deliberately not here.** LT-109/LT-110/LT-111 wait on LT-280's design grilling, which is
architect work and not scheduled in a developer iteration. LT-309–LT-311 (codeblock
follow-through and two designs) still wait for evidence: this batch shows whether the
root-attribute and compose-event patterns recur. LT-319 is not tripped: coloreditor's compose
sites all have distinct classes. The i18n chain (LT-242 → LT-233 → LT-250), the ADR 0037
implementation (LT-274–LT-276) and the ADR 0033 CSS track (LT-268 → LT-304/LT-306) do not
contend with this batch and keep for later iterations. The P1 publish track stays behind P6.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained
(LT-095, LT-104–LT-108), every spec green on every surface they carry, zero warnings, and tier +
reason recorded per migration. Coloreditor and context-media carry specs of their own. Lazyload's
boundary is spelled `<truc:try>`, and no `boundary(` survives in code (LT-303).
`examples/tsconfig.json` hand-lists no generated client (LT-325). A loop inside a branch fails
LTC005 on both surfaces (LT-301, copy reviewed by LT-300). A `@case` test over a
context-member-seeded signal routes Simulated (LT-330). `bun run check:sim` exits 0 (LT-329). A
build-time shuffle in a loop iterable fails LTC033 (LT-326). Args named `items`/`esc` render on
both surfaces (LT-302). The census is 27/2/0 before the batch; each migration adds its own entry.

**Next free task ID: LT-332.**

---

### Gates (run first)

All three gates landed and were reviewed on 2026-09-25 (LT-325, LT-301, LT-300; see `DONE.md`).

### Migrations (LT-104 before LT-107; LT-095, LT-106, LT-108 ungated)

- [ ] LT-104: Migrate `module-lazyload` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-107: Migrate `module-listnav` to `.tsx` with same-commit cutover.
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

- [ ] LT-105: Migrate `module-coloreditor` to `.tsx` with same-commit cutover.
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

- [ ] LT-106: Migrate `context-media` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.
  **Planning note (2026-09-25):** write the spec against the `.ts` twin first (LT-324 precedent).
  A browser check alone leaves `test:variants` with nothing to verify on either surface.

- [ ] LT-108: Migrate `module-carousel` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision). **Carries LT-173's deferred blogmeta fold verification.**
  **Skill:** le-truc-dev
  **Context:** Design decided 2026-08-29: fully-typed props, NO arbitrary pass-through
  (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published`
  (datetime string), `modified` (optional datetime string), `reading-time` (optional number,
  minutes). The template re-emits ALL the schema.org microdata the old light DOM carried —
  `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`,
  `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the
  reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the
  modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside
  `<basic-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date
  handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to
  port: `examples/basic/blogmeta/basic-blogmeta.html`, `server/effects/pages.ts`
  (`emitBlogCards`), `docs-src/layouts/blog.html`, the examples.md demo markup.
  **Date handling is prescribed** (ADR 0030 s2, and it is what makes the fold possible): use
  `Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'` in the formatter — never shifts the day, reads
  no ambient state. The current `new Date(year, month - 1, day)` + zone-less
  `Intl.DateTimeFormat` reads the build machine's timezone and must not survive the migration.
  Verify the component classifies Folded once migrated; LT-173 step 6 deferred its fold
  verification here.

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
