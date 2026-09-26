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

- [x] LT-252: Corpus and catalog migration to ICU patterns — `basic-pluralize` (both surfaces), six locale catalogs, manifest rebaseline. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** basic-pluralize (`.tsrx` and `.tsx`, parity green) declares one `tasks` pattern,
  `{type, select, ordinal {{count, selectordinal, …}} other {{count, plural, …}}}`, and
  renders it in one `.tasks` span through `t.tasks({ count: host.count, type: host.ordinal ?
  'ordinal' : 'cardinal' })`. The six `truc:case` spans, `truc:case-type` and the
  `pluralCategory` helper are gone, and `.zero`…`.other` leave the DOM contract. The six
  catalogs carry one `basic-pluralize.tasks` each; the ordinal arms keep the old per-category
  forms. The manifest is rebaselined, with the `task.*` hashes pruned by hand (`i18n:sync`
  prunes orphaned catalog keys but not their manifest entries). module-todo and the test page
  carry no word forms. The test page's six locale instances carry hand-copied `i18n` attributes
  (→ LT-352). The census is 0 gaps, the tier census and warning baseline are unchanged, and the
  component stays Folded.
  **Rulings:** (1) This is the ADR 0030 s5 **sanctioned rebaseline**: no translation's meaning
  changed, so no key is marked stale. The owner's single commit must say so; it is the
  precedent LT-253's MF2 migration cites. (2) The en byte delta is **+502** (226 → 728): the
  body shrinks by 37 bytes and the `i18n` attribute adds 539. It is pinned in
  `gate-wave-verification.test.ts`. The levers and the ADR consequence amendment → **LT-351**
  items 4–5. (3) Pruning arms for a connect-time `ordinal` is declined, because the prop is
  writable.
  **Review:** Approved. `basic-pluralize.spec.ts` and `module-todo.spec.ts` were rewritten but
  could not run under the agent sandbox. The owner runs them (en and de) before the commit. A
  jsdom test connects the whole raw test page and is green in the meantime. JSDoc lead copy →
  LT-220 item 0.

- [x] LT-350: Client message fallback — a node kind the narrowed evaluator does not carry renders that key's source message (LT-218 review, owner ruling 2026-09-26). — done ✓
  **Skill:** le-truc-dev
  **Changed:** The generated preamble's evaluator gives `plural`/`select` explicit cases and
  throws a private sentinel for any other uncarried kind; an argument key's accessor catches it
  and formats the source message (wrong language until the catalog is fixed, never blank). The
  census reports such translations as `client-fallback` (LT-219).

- [x] LT-219: Corpus adoption — tokenbox + colorgraph event-time strings; retire the carrier-span idiom; census placeholder check. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** form-tokenbox declares `added`/`removed`/`duplicate` (`{token}` patterns); its
  status writes and duplicate `setCustomValidity` go through `t.<key>({ token })`.
  form-colorgraph declares `outOfGamut` for its three `on(...)` sites. form-spinbutton's hidden
  `.increment-label` carrier span is retired; the thunk reads `t.increment`. de translated, the
  other five locales carry `""` placeholders. New `RegistryEntry.clientMessageKeys` (additive).
  `icu/evaluate.ts` gains `carriedKinds`/`clientFallsBack`, shared by `emit-client.ts` and the
  census. Translation census: four new `TranslationGap` statuses — `malformed`,
  `argument-mismatch`, `missing-arms`, `client-fallback` — plus an optional `detail`; the
  i18n report buckets every status; `i18n:sync` lists them and fixes none. New Playwright spec
  `form-tokenbox.spec.ts` (en and de announcements, de duplicate validity) over a pre-rendered
  de instance on the test page.
  **Rulings:** (1) The LT-190 reachability carve-outs stay until LT-251 deletes them; the new
  walks run beside them. (2) `malformed` is the one status for a bad catalog value — LT-249
  adds the non-string half to it, no sibling status. (3) Hand-copied test-page attributes get
  a drift pin → **LT-352**.
  **Review:** Approved. Census reasons and the `i18n:sync` FLAGGED line → LT-189 item 8.
  Rider: `test-debug.spec.ts`'s structural-wrapper fixture swapped `card-callout` (a compiled
  component since LT-033, so it owns `debug`) for `module-demo`.

- [x] LT-349: Finish LTC005's positive server-only rule — reactive-list bodies, compiler-generated query names, and `t.<key>` in the two positions LT-218 left out (LT-348 and LT-218 reviews). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** Compiler-generated query locals no longer shadow a server binding: args
  `{ button }` read in a queried `<button>`'s handler is LTC005. Both `loops.ts` list-body checks
  (server-data attribute/thunk, reactive-list item handler) drop the `JS_GLOBALS` allowlist for
  the positive rule (`badListBodyNames`) and report through `reportServerOnlyNames`, so they
  carry the LT-348 tail; the `listHandlerNames` wording key is gone. `staticMessageReads` moved
  to `i18n.ts`; the client-only setup gate (`setup-extraction.ts`) and list-item handlers admit
  a static `t.<key>` read of a declared key, recorded into `clientMessageKeys`.
  `readModuleDecls` now runs before `extractSetup` (the gate needs the declared keys). Pins:
  `diagnostic-parity.test.ts` (LIST_BODY, SERVER_ONLY, clean list cases),
  `i18n-client.test.ts` (colorgraph- and tokenbox-shaped fixtures ride the attribute).
  **Ruling:** Setup consts and authored imports stay rejected in list bodies, even when a
  client position elsewhere already emits them — `computeClientNeededNames` walks no list-body
  position, so admission would depend on unrelated usage. Widening that walk is the fix if a
  component ever needs it; no current or LT-219 consumer does (tokenbox's handler reads refs,
  the list and `t`).
  **Review:** Approved. Copy (the two list-body subjects) → LT-189 item 17.

- [x] LT-218: The client-message `i18n` attribute — compiler analysis, server emission, client evaluator preamble (ADR 0030 sub-design 9). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** A static `t.<key>` read of a declared key compiles in client positions
  (`badFreeNames`), and its key lands in `ClientPlan.clientMessageKeys`. When keys exist, the
  server renders a root `i18n` attribute through `runtime.ts`'s new `clientMessages`. The
  generated `i18n` module tags argument-message closures with their AST under
  `CLIENT_MESSAGE`. The generated factory gains a preamble: the source record, a guarded parse,
  an inlined evaluator narrowed to the source constructs with one formatter per node, and a
  local `t`. `icu/evaluate.ts` gains `bakeMessageEnv` and an optional per-node locale `l`. New
  optional IR field `ComponentIR.messageTBindings`. Computed keys, a bare `t`, `i18n.t.<key>`
  and `lang` (with a `host.lang` pointer) stay LTC005. Pins: `i18n-client.test.ts`.
  **Rulings (owner, 2026-09-26):** (1) A translation using a construct its source lacks falls
  back per key to the source message, and the census reports it → **LT-350**, LT-219 census
  case (c). (2) A server-rendered instance formats in the render locale baked into each
  serialized message ("a component with known lang folds the chosen lang in"). What a
  client-created instance speaks is open → **LT-351** (Architect design, with the ADR 0030
  s6/s9 amendment). (3) `t.<key>` in client-only setup statements and list-body handlers is
  admitted in **LT-349**, which now gates LT-219.
  **Review:** Approved. Copy → LT-189 item 17.

- [x] LT-348: LTC005's server-only check rejects valid browser code — define "server-only" positively (LT-347 review). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `badFreeNames` is positive. A name is server-only iff the server render binds it
  (component parameters, module-level declarations, server-data loop bindings) and the client
  does not rebind it. One rule covers every client position. Harvest-less signal initializers
  are checked. New optional contract field `ComponentIR.moduleBindings?: string[]` (additive).
  `emit-tier.test.ts`'s Simulated fixture seeds `createCell(0)`. First-draft tail: "those
  exist only during the server render — read the value through an exposed prop or from the
  DOM".
  **Rulings:** (1) Owner, 2026-09-26: the flipped `compiler.test.ts` pin is intended. An
  undeclared name (`mysteryHelper`) has no binding class, so it is tsc's to report, not
  LTC005's. (2) Architect, 2026-09-26: a tier never licenses an unbound client name, so a
  harvest-less initializer reading a parameter is LTC005 in every tier. (3) Architect,
  2026-09-26: only author-declared client bindings rebind a server name. Compiler-generated
  query locals do not.
  **Review:** Approved with one follow-up. The `clientRebinds` query clause follows the task
  text but violates ruling 3 → **LT-349**, which also moves the `loops.ts` list-body checks
  off the allowlist. Copy → **LT-189 item 17**.

- [x] LT-347: A server-only name in a reactive text-child thunk compiles clean and throws on the client (LT-252 finding). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** LTC005's server-only check now covers every position the client emits authored
  code into: lazy text children, class/style maps, template `on*` handlers, `expose()` entries,
  and plain setup consts a client position pulls in. Previously only reactive attributes, pass
  entries and `truc:html` were checked. One helper (`reportServerOnlyNames`) writes the
  sentence. `badFreeNames` admits FactoryContext primitives. A `.tsx` converter fix: array
  binding elements were emitted as shorthand `Property` nodes, so `([x]) => …` left `x` free
  in every `.tsx` free-name walk. Pinned by the parity suite's `SERVER_ONLY` group (both
  surfaces, one fixture per position) and a clean-case test.
  **Review:** Approved with one follow-up. Widening the audit into fixes was right. But the
  handler and map positions inherited `badFreeNames`' allowlist and now reject valid browser
  code (`clearTimeout`, `fetch`, `getComputedStyle`, `matchMedia`) as "server-only" →
  **LT-348**, which also carries the harvest-less-signal ruling (tier never licenses an
  unbound client name). Copy → **LT-189 item 17**.

- [x] LT-343: module-codeblock — `id` required whenever the overlay renders `aria-controls` (LT-308 review). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `module-codeblock.tsx` args are a union on `collapsed`
  (`{ collapsed: true; id: string } | { collapsed?: false; id?: string }`), and the overlay
  reads `aria-controls={id}` with no fallback. `collapsed` lost its destructuring default and
  the tag reads `collapsed={collapsed ?? false}`, because a default blocks tsc's narrowing of
  `id`. `JSX.LibraryManagedAttributes` in `host-profile.d.ts` now distributes over unions.
  Rendered bytes and the generated client are unchanged.
  **Rulings (Architect, 2026-09-26):** (1) The distributive `LibraryManagedAttributes` is the
  profile's rule for every child: a plain `Omit` over a discriminated args type flattens it to
  the common keys and silently drops the requirement. (2) `id` is *not* required
  unconditionally: a page occurrence without an `id` would then stop rendering from its
  attributes (`argsFromAttrs`). (3) A union parameter type opts out of the compiler's
  inline-literal type reading (`infer-type.ts`: LTC032, inferred arg types). That is
  acceptable here because the output is byte-identical. It is not a pattern to spread
  without checking the generated modules.
  **Live handoffs:** the compose-site check is unpinned → **LT-346**. A generated fallback id →
  LT-345 (backlog).
  **Review:** Approved.

- [x] LT-344: Type a plain `{x}` ICU argument as `string | number` in the generated record (LT-250 review). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `MessageArgKind` gains `plain`, generated as `string | number`. When one
  argument is used several ways, the narrowest use wins: number/date over string (a `select`
  selector) over plain. Pins are in `icu.test.ts` and `i18n.test.ts` (generated-program tsc).
  **Review:** Approved. It removes a false positive between the authored and generated channels.

- [x] LT-250: ICU MessageFormat — the build half: parser, shared evaluator, server fold, argument diagnostic (ADR 0030 s4). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/compiler/icu/parse.ts` (`@messageformat/parser` → compact JSON AST;
  skeletons resolved to `Intl` options at build time; `MessageArg` kinds) and
  `icu/evaluate.ts` (`formatMessage`: no imports, re-exported from `runtime.ts`; LT-218
  inlines a narrowed copy). `ComponentIR.i18nArgs` (optional, contract-additive). The generated
  `i18n.ts` closes argument messages over `formatMessage` and drops `''` placeholders and
  unparseable translations at generation, so they fall back to the source. New
  devDependencies: `@messageformat/parser`, `number-skeleton`, `date-skeleton`.
  `@messageformat/core` is a test oracle only, and a test fails if `server/compiler/` imports it.
  **Rulings (Architect, 2026-09-26):** (1) the code is **LTC055**, not `TSRX`: the shared
  machinery emits it on both surfaces (ADR 0028 amendment, VOCABULARY_LEDGER §4). (2) One code
  covers two faces: an unparseable *source* pattern (the source has nothing to fall back to)
  and a call-site argument mismatch. Both are the statically decidable ICU-message family. (3)
  The supported MF1 surface is what `Intl` can run. The refusals (custom formatters, ICU
  number/date *patterns*, `precision-increment`, one argument as both number and date) are
  reasoned, not disagreements with core. (4) `date`/`time` apply the record's `timeZone` (ADR
  0030 s2). This is a deliberate divergence from core, pinned under `TZ=UTC`. (5) The call-site
  check does not track shadowing and leaves undeclared keys to TypeScript (LT-308).
  **Live handoffs:** LTC055 final copy → LT-189 item 16. A plain `{x}` typed `string` is too
  strict → **LT-344**. Per-call `Intl` construction on the client → LT-218's handoff note.
  **Review:** Approved. Tier census 30/5/0 unchanged; warning baseline 0; the argument-less
  output is byte-identical.

- [x] LT-308: Per-key types for the reserved `i18n` record; revert the intrinsic-attribute `undefined` widening (LT-237 follow-up). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** `I18n<M>` with `MessageOf`/`MessageArgs`, identical in
  `frontend/tsx/host-profile.d.ts` and `frontend/tsrx/globals.d.ts`. All eleven `export const
  i18n` files (eight tags) now spell `{ … } as const` and `i18n: I18n<typeof i18n>`.
  `readI18nDecl` unwraps a const assertion, and `to-estree.ts` keeps the annotation for
  `as const` only. `emit-server.ts` rewrites `I18n<typeof i18n>` to the exact inline record
  (`i18nAnnotated`/`messagesRecordType` in `compiler/i18n.ts`). The generated `i18n.ts`
  exports `I18n<T>` and `i18nRecord<T>()`. `Attr<T>` is gone, and plain attributes are
  `Reactive<T>` without `| undefined`.
  **Rulings (owner + Architect, 2026-09-26):** dropping `| undefined` is honest. It stays only
  where it is the literal meaning, "absent when omitted": `truc:case-type`, which it had before
  LT-237 and which LT-251 retires, and component-tag config attributes that mirror an optional
  arg (context-media `sm`…`xl`, lazyload `src`/`allow-scripts`, scrollarea/splitview
  `orientation`). These are that component's own root attributes, not ARIA or global
  attributes, so the accessibility argument does not reach them. A bare `I18n` stays loose (the
  default `M`). The escaped-brace misclassification on the authored side is accepted and
  recorded in HOST_PROFILE.
  **Live handoffs:** codeblock's `aria-controls={id ?? ''}` → **LT-343**. A generated
  fallback id → **LT-345**.
  **Review:** Approved. The negative probes (`fixtures/tsx/i18n-bad-reads.tsx`) cover every
  exit clause, and the generated-program test pins the exact record.

- [x] LT-242: Extend the parity suite to diagnostics — the equivalence contract covers failed compiles too (ADR 0032 amendment). — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/tests/compiler/tsx/diagnostic-parity.test.ts`; ADR 0032 s6 and
  `ARCHITECTURE.md` § Authoring Surfaces now read "render byte-identically **and diagnose
  identically**" (s6's stale suite path fixed too).
  **Ruling (Architect, 2026-09-25):** parity alone cannot see shared machinery that speaks one
  surface's vocabulary to both — identical, and wrong for one. The contract therefore has TWO
  checks, both standing: equal code + severity + message after translating `.tsx` through an
  allowlist, AND a leak scan that rejects `.tsrx` directive vocabulary in any `.tsx` message.
  The §2.3 per-item `ref` drift had already converged in practice (`classify-attributes.ts`
  retires `ref={}` on both surfaces first).
  **Review:** Approved. The pins were mutation-checked (reintroducing the §1.1 bug fails the
  suite); every allowlist entry must be exercised, so the table cannot rot.

- [x] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. — reviewed ✓
  **Skill:** le-truc-dev
  **Changed:** new `server/compiler/front-end.ts` (`SurfaceAdapter`, `runFrontEnd`,
  `createExtractContext`, `CompileResult`) and `server/compiler/surface.ts` (one
  `SurfaceWording` table per surface, `wordingOf`); `lower-shared.ts` owns the programs after
  header parsing (`lowerLoop` over a `LoopSource`, `finishIf`, `finishTry`,
  `reportEmptySwitch`); ~40 `.tsrx`-worded messages in `analysis/effects.ts`,
  `analysis/loops.ts` and five `diagnostics.ts` builders now compose from the vocabulary.
  Generated corpus artifacts byte-identical. User-visible (CHANGELOG `[Unreleased]` Fixed,
  landed): `.tsx` diagnostics no longer name `.tsrx` directives or the retired `&{}` sigil, and a
  `.tsx` list `.map()` body with statements besides its `return` is rejected instead of
  silently dropping them.
  **Rulings (Architect, 2026-09-25):**
  - **Shared compiler code never spells a surface's construct itself** — it reads
    `wordingOf(ctx | component)`. A message only one grammar can reach may stay a literal; two
    such (the `.tsrx` key clause, the `.tsx` `.map()` arity) sit in the shared `lowerLoop`
    because the check ORDER is shared — accepted, and each is commented as single-surface.
  - **`ComponentIR.surface` is OPTIONAL; absent ⇒ `.tsx` wording.** It is contract IR
    (`contract.ts`: a required field would be a tightened shape, i.e. major), and a third-party
    front end has neither vocabulary — `.tsx`'s JavaScript-expression spelling is the nearer
    fit. `ExtractContext.surface` is internal and required. No neutral third table unless a
    real third-party front end reads wrong under the `.tsx` words.
  - **The `.tsx` reactive-list key binding is a capability gap, not wording** → LT-342.
  **Handoffs:** LT-189 item 15 (the vocabulary's copy); LT-275 rider (ADR 0037 codes join
  `surface.ts`, the parity `CONDITIONS` cases flip with them); LT-342.
  **Review:** Approved. Diff re-read for order drift: the one reordering (the `.map()`
  callback-body check now precedes the item-name check) is unreachable for arrow callbacks.

Pruned 2026-09-25, third pass (Architect, after the "wave 4, second batch" iteration closed;
Changelog Keeper merged it into `CHANGELOG.md [Unreleased]` the same day). **No task entries
remain.** Every one was either consumed with nothing left to carry, or reduced to a ruling in
the standing notes below, tagged with its source ID. Consumed: LT-095, LT-104–LT-108, LT-179,
LT-188, LT-207, LT-212, LT-213, LT-258, LT-266, LT-290, LT-295, LT-296, LT-300–LT-303,
LT-312, LT-314, LT-316, LT-319, LT-320, LT-323, LT-325, LT-326, LT-328–LT-330, LT-332, LT-338,
LT-339, LT-341. Open handoffs are restated in their own entries: LT-189 items 5, 11–14, LT-297,
LT-309–LT-311, LT-331, LT-333–LT-337, LT-340. Earlier prunes: 2026-09-25 ×2, 2026-09-21 ×2.
Full entry text: `git log -p -- DONE.md`.

**Open obligations** (not yet discharged; check before closing the named work):
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
