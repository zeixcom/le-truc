# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): the ICU MessageFormat switch, end to end.** Drawn
from [BACKLOG.md](BACKLOG.md)'s P2 band (all of it), two P2b gates, and two P6 items. The
previous iteration ("wave 4, second batch") is fully landed and reviewed: LT-095 and
LT-104–LT-108 serve as compiled `.tsx` with their twins retained, and every gate and rider it
carried is closed (LT-300–LT-302, LT-319, LT-325, LT-326, LT-328–LT-330, LT-332, LT-338,
LT-339). Compacted records are in `DONE.md`; the public summary is in `CHANGELOG.md
[Unreleased]`. LT-329's Deno leg was verified locally by the owner on 2026-09-25 and filed LT-341.

**Why now (owner, 2026-09-25).** The MF1 ruling (LT-240, ADR 0030 s4) is six days old and has
one component authored against the retired `truc:case` shape. That count only grows: every
wave-4 migration that declares `i18n` adds to it. Each new catalog key also raises the MF2
exit's cost (LT-253). The migrations no longer contend for the compiler's front ends, so the
consolidation gate can land without blocking anyone.

**Ruling taken at planning (owner, 2026-09-25; ADR 0030 s4 amended): `t` is typed per key.**
The 2026-09-19 ruling kept `t` as `string | ((args) => string)` and deferred per-key
precision. With that union, every attribute that reads a message (`placeholder={t.filter}`)
fails tsc, because a function is not an attribute value. So **LT-308** is re-scoped: it runs
after LT-250 and types each key from LT-250's parse. Authored `.tsx` gets `I18n<typeof i18n>`
over an `as const` declaration; the generated modules get exact argument records. LT-250 item 5
and LT-220 item 0 are amended to match. The loose union never ships.

**The chain.**
- **Gates (P2b).** **LT-242** puts the diagnostic-parity net in place, then **LT-233** collapses
  the two copied front-end drivers under it. Every later task edits both surfaces, and LT-233
  makes that one edit.
- **Build half.** **LT-250** adds the parser, the shared evaluator, the server fold and the
  argument diagnostic. **LT-308** adds per-key types. **LT-252** rewrites basic-pluralize and
  its six catalogs to one pattern each, as the sanctioned manifest rebaseline in one commit.
  **LT-251** deletes `truc:case`, pruning and `pluralCategories`, and retires LTC008.
  **LT-253** pins the MF2 exit while the corpus is one pattern.
- **Client channel.** **LT-218** adds the per-instance `i18n` attribute and the inlined,
  narrowed evaluator. **LT-219** moves tokenbox, colorgraph and spinbutton onto it, retires the
  carrier span, and adds the census pattern walks. **LT-249** lands with LT-219 as one
  `malformed` census family.
- **Copy.** **LT-220** covers the message-model docs. **LT-189** is the standing one-voice
  Tech Writer round (fourteen items). The two run as one round, last, so the new ICU codes
  join it.
- **Parallel slot.** **LT-138** was promoted by the LT-102 review. module-splitview authors
  `truc:html`, so the inverted sanitizer defaults are now live in the corpus. Its first step
  is the fixture that confirms the flip.

**Order.** LT-242 → LT-233 → LT-250 → LT-308 → LT-252 → LT-251. LT-253 after LT-252.
LT-250 → LT-218 → LT-219 (with LT-249). LT-220 and LT-189 run as one Tech Writer round after
LT-219, as LT-220's header asks. LT-138 is ungated.

**Deliberately not here.** The ADR 0037 implementation (LT-274–LT-276) and the ADR 0033 CSS
track (LT-268 → LT-304/LT-306) are the next compiler-heavy candidates. They contend with LT-233
for both front ends, so they wait. LT-280's design grilling (gating LT-109–LT-111) is still
architect work. LT-340 (from LT-326's review) and the rest of P3 stay parallelizable for the
following iteration. The P1 publish track stays behind P6.

**Exit criterion:** both surfaces diagnose identically over the seeded invalid fixtures
(LT-242). One `runFrontEnd` drives both front ends, with goldens and parity byte-identical
(LT-233). An ICU pattern folds server-side, differentially green against `@messageformat/core`,
and `@messageformat/core` is absent from `server/compiler/` production imports (LT-250).
`t.fliter` and a bare `{t.tasks}` in an attribute fail tsc, and `Attr<T>` is `Reactive<T>`
again (LT-308). basic-pluralize renders one span, with the byte delta pinned, and all six
catalogs carry one pattern (LT-252). `grep "truc:case\|pluralCategor\|caseType"` finds only
retirement notes (LT-251). The MF1 → MF2 round-trip suite runs in `bun test server/tests`
(LT-253). tokenbox, colorgraph and spinbutton announce event-time strings in en and de through
the `i18n` attribute, a component without client messages renders byte-identical, and the
census reports argument, arm-coverage, unparseable and malformed entries (LT-218, LT-219,
LT-249). The docs teach the ICU model with no trace of the per-category convention or the
wider-type caveat (LT-220, LT-189). server and client agree on the `truc:html` sanitizer
default (LT-138). Across all of it: warning baseline 0, tier census unchanged from the
iteration's opening measurement (record it before the first change), and `bun run build:docs`
and `check:links` pass.

**Next free task ID: LT-342.**

---

### Gates (run first)

- [ ] LT-242: Extend the parity suite to diagnostics — the equivalence contract covers failed compiles too (ADR 0032 amendment).
  **Skill:** le-truc-dev
  **Context:** Reflection §2 (rank #2 of its list; cheap). The parity suite — the same component
  authored in both surfaces must render byte-identically — tests successful renders. **All three
  live drifts COMPILER_REVIEW §2.3 documented live in the diagnostic path**, where the parity
  suite could not have caught any of them (the `offenders` truthiness bug — fixed LT-221; the
  `keyName` arm — ruled grammar asymmetry, LT-221; the per-item `ref` message — closes in
  LT-233). Under the framework premise the equivalence contract is a **product promise to users
  of either surface**: the same invalid component must produce the same code and the same
  message text, or one surface teaches its users lies the other never hears. This is cheaper
  than the `SurfaceAdapter` refactor and catches the class the refactor is meant to prevent —
  it also then verifies LT-233's message consolidation, which is why it runs first.
  **How:** extend `server/tests/compiler/tsx/parity.test.ts` (or a sibling) to compile a set of
  invalid fixtures through both front ends asserting equal `DiagnosticCode` + equal message
  text. Surfaces legitimately differ in vocabulary fragments (surface-register words and the
  like) — define that allowlist explicitly as a table in the test; LT-233's `SurfaceWording`
  fold then shrinks it toward zero where the review's item 14 says it should. Seed with
  negative pins for the three §2.3 shapes plus a sample of each diagnostic family.
  **ADR:** this amends the ADR 0032 equivalence contract (the s6 anti-drift statement) —
  adr-keeper pass in the same change; the contract sentence in `ARCHITECTURE.md`
  § Authoring Surfaces gains "and diagnose identically."
  **Verification:** the three §2.3 shapes are pinned (two already fixed — the pins prove they
  stay fixed); `bun test server/tests` green; `check:links` after the doc touches.
  **ADR 0037 rider (2026-09-21):** seed coverage includes the LTC005 condition-face
  retirement and [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)'s new
  codes — both surfaces must diagnose reactive-condition shapes identically from day one.

- [ ] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. **GATES LT-218 (P2, with S0's LT-240): land before it.**
  **Skill:** le-truc-dev
  **Context:** Review §2.3/§3 item 14. `compileSource` (`frontend/tsrx/compiler.ts:199`)
  and `compileSourceTsx` (`frontend/tsx/compiler-tsx.ts:106`) are the same eight-step
  script — the setup slice, `decl.body.type`, three message strings, and a
  verbatim-duplicated ~200-character async-rejection message are the only differences;
  the early-exit literal repeated 6× per driver collapses into the shared driver. Same
  for the `lowerFor`/`lowerListFor`/`validateListBody` triples: header parsing genuinely
  differs, the program after `itemName`/`iterableName` is one — this copied seam is
  where the §1.1 and §1-(5) drifts happened. Shape: a `SurfaceAdapter`
  (`componentBodyType`, `splitSetupAndOutput`, `stylesheetOf`, `outputShapeLabel`,
  `lowerChildren`, `lowerElement`, `preScans`) + `runFrontEnd(ctx, ast, adapter)`; each
  `compileSource*` becomes parse + adapter + call. Fold `SurfaceWording`
  (`lower-shared.ts:56` — three strings while ~30 surface-specific fragments sit inline
  at call sites) into one complete surface vocabulary; the current version is worse than
  nothing (anti-drift theatre). The per-item `ref` message drift (.tsx generic vs .tsrx
  explicit rejection) closes here; final wording batches with the LT-189 compiler
  families. Runs after LT-242 so the diagnostic-parity net catches any message drift
  this consolidation could introduce.
  **Verification:** goldens + parity byte-identical (the parity suite is the standing
  cross-surface contract); the LT-242 diagnostic-parity pins stay green; warning
  baseline 0; census unchanged from the iteration baseline; full gates green.

### Build half (LT-250 → LT-308 → LT-252 → LT-251; LT-253 after LT-252)

- [ ] LT-250: ICU MessageFormat — the build half: parser dependency, AST, shared evaluator, server fold, argument diagnostic (ADR 0030 s4). **Gated by LT-233 (SurfaceAdapter); gates LT-308, LT-218, LT-251, LT-252.**
  **Skill:** le-truc-dev
  **Context:** The LT-240 ruling (owner, 2026-09-19; ADR 0030 s4 amended) in code. A message
  value becomes an ICU MF1 pattern; `t.<key>` resolves to a string when the pattern takes no
  arguments and to a function of its arguments when it does.
  1. **Parse, don't compile.** Add `@messageformat/parser` as a **devDependency** (build-time
     only), plus `@messageformat/number-skeleton` / `@messageformat/date-skeleton` where
     skeletons appear — they resolve to plain `Intl` options at build time, so nothing
     skeleton-shaped survives into the AST. `@messageformat/core` goes in as a **test oracle
     only** and must not be imported from `server/compiler/` production paths (pin that with
     a dependency test).
  2. **One evaluator, ours, used by both sides.** A compact AST walk over the parsed pattern.
     `Intl.PluralRules` / `NumberFormat` / `DateTimeFormat` do the locale work. The SAME
     evaluator runs the server fold and is inlined into the client preamble by LT-218 — the
     point of owning it is that a server-rendered string and the client's recomputation
     cannot disagree. Keep it emitter-agnostic and free of compiler imports so LT-218 can
     inline a narrowed form of it.
  3. **Fold at render.** `t.key({ … })` with server-known arguments folds in the value
     harness like any other call (`evaluability.ts` — new node shape, existing rule). A
     message with client-reactive arguments is left to LT-218's channel.
  4. **Argument validation** — the compiler checks a call site's arguments against the parsed
     pattern's argument set: **new TSRX code, tier 1 Prevented, error** (statically decidable,
     author-fixable; Tech Writer owns copy, batch with LT-189). Lives in the shared
     post-lowering pass so it cannot drift between the two authored surfaces. A computed
     `t[dynamicKey]` stays rejected, unchanged.
  5. **Types: per key, in LT-308** (owner ruling 2026-09-25, ADR 0030 s4 amended; supersedes
     the 2026-09-19 "types stay loose" ruling). This task exposes what LT-308 needs: for each
     declared key, whether the parsed pattern takes arguments, and each argument's name and
     kind (`plural`/`selectordinal`/`number` → number, `date`/`time` → date, otherwise string).
     Surface it on the extraction result, not in a side table. Do not ship the loose
     `string | ((args) => string)` union in the meantime. Until LT-308 lands, keep the
     `.tsx` host profile's `t` at `Record<string, string>`: no corpus component calls
     `t.key({ … })` before LT-252, and LT-252 lands after LT-308.
  **Check:** the evaluator's server output is differentially tested against
  `@messageformat/core` over the corpus patterns plus a negatives set (this is what the oracle
  is for); folded markup for an argument-less message is byte-identical to today's; gates green
  (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links); warning baseline 0;
  tier census unchanged (a folded message is not a routing signal).

- [ ] LT-308: Per-key types for the reserved `i18n` record, then revert the intrinsic-attribute `undefined` widening (LT-237 review follow-up; re-scoped 2026-09-25). **Depends on LT-250; gates LT-252.**
  **Skill:** le-truc-dev
  **Context:** `I18n.t` is `Record<string, string>` in the `.tsx` host profile
  (`server/compiler/frontend/tsx/host-profile.d.ts`), the `.tsrx` `globals.d.ts` and the
  generated `i18n.ts`. So under `noUncheckedIndexedAccess` every `t.<key>` read is
  `string | undefined`, and any key typechecks: `t.fliter` passes tsc and renders `undefined`.
  LT-237 unblocked `placeholder={t.filter}` by widening every intrinsic attribute to
  `Attr<T> = Reactive<T> | undefined`. That also silently admits a possibly-undefined
  `aria-label={maybeLabel}`, an accessibility regression tsc no longer reports. ICU patterns
  (LT-250) add a second problem: a message with arguments is a function, and a loose
  `string | fn` type breaks every attribute that reads a message. The owner ruled
  (2026-09-25, ADR 0030 s4 amended) that `t` is typed **per key**, now rather than later.
  1. **Authored side:** `interface I18n<M extends Record<string, string> = Record<string, string>>`
     with `t: { readonly [K in keyof M]: MessageOf<M[K]> }`. `MessageOf<V>` is `string` for a literal
     without `{`, `(args: MessageArgs) => string` for a literal containing `{`, and the `string | ((args: MessageArgs) => string)` union when
     `V` is plain `string` (the `as const` was forgotten: the first attribute read then fails tsc
     instead of passing silently). `MessageArgs` is `Record<string, string | number | Date>`.
     Identical in the host profile and `globals.d.ts`. An ICU-escaped literal brace (`'{'`)
     misclassifies an argument-less message as a function on the authored side. Accept this:
     the compiler diagnostic (LT-250 item 4) and the generated-module types are exact, and the
     corpus has no such pattern. Record it in HOST_PROFILE's i18n paragraph.
  2. **Authored spelling:** `export const i18n = { … } as const` and
     `i18n: I18n<typeof i18n>`. Annotate every component that declares `export const i18n`, on
     both surfaces (eight today).
  3. **Generated modules:** the server module does not carry the `i18n` const (it imports only
     the `I18n` type), so the compiler rewrites the annotation to an exact inline record from
     LT-250's per-key shape: `{ filter: string; tasks: (args: { count: number }) => string }`.
     Generated modules stay self-contained. Rejected alternative: emitting the const into the
     server module, which duplicates the fallback bytes the staleness manifest hashes.
  4. Revert `Attr<T>` to `Reactive<T>` and drop the `| undefined` on the plain attributes.
     Re-add `?? ''`-style fallbacks only where a value really is optional (form-listbox's
     `aria-label={ariaLabel ?? ''}` already is).
  **Channel:** TypeScript, tier 1 Prevented, for an undeclared key, a missing call on an
  argument message, or a call on an argument-less one: on `.tsx` in the examples program, and
  in `check:corpus`'s generated program on both surfaces (with exact argument names there).
  No new LTC rule; LT-250's argument diagnostic stays the channel for authored `.tsrx`.
  **Check:** `placeholder={t.filter}` typechecks with `Reactive<string>` attributes; `t.fliter`
  fails tsc in the examples program and in `check:corpus`; a fixture with an argument pattern
  shows `t.tasks({ count: 1 })` typechecking and bare `{t.tasks}` in an attribute failing; a
  fixture without `as const` fails at the first attribute read; a temporary
  `aria-label={maybeUndefined}` fails again; parity and goldens show only the annotation
  change; HOST_PROFILE.md's i18n paragraph shows the annotated spelling.

- [ ] LT-252: Corpus and catalog migration to ICU patterns — `basic-pluralize` (both surfaces), six locale catalogs, manifest rebaseline. **Depends on LT-250 and LT-308; gates LT-251.**
  **Skill:** le-truc-dev
  **Context:** The ruling's own check: *every component authored against `truc:case` is a
  component rewritten.* At ruling time that is exactly one — `basic-pluralize`, in
  `examples/basic/pluralize/basic-pluralize.tsrx` and its `.tsx` twin — which is why the
  ruling landed on 2026-09-19 rather than after the next authoring.
  - **Component:** the six `truc:case` spans plus their six `hidden` thunks collapse to one
    element and one thunk: `{() => t.tasks({ count: host.count })}`. The `.none` / `.some`
    split and the `ordinal` prop survive (ordinal selection moves inside the pattern via
    `selectordinal`). Both surfaces stay byte-identical per the ADR 0032 parity contract.
  - **Catalogs:** rewrite `i18n/{ar,cy,de,lv,pl,zh}.json` — `basic-pluralize.task.{zero,one,
    two,few,many,other}` collapse into one `basic-pluralize.tasks` pattern per locale.
    **The six-category locales (ar, cy) are the real test**: their arms move inside the value,
    which is the whole point. de's four category keys become one.
  - **Manifest:** this is the ADR 0030 s5 **sanctioned rebaseline** — sources, translations and
    `i18n/manifest.json` change in ONE commit, so no translation is marked stale for a change
    that altered no meaning. Say so in the commit message; it is the precedent the MF2
    migration will cite.
  **Check:** translation census 0 gaps across all six locales with the new pattern walks live;
  rendered markup for an en page shrinks from six spans to one (pin the byte delta — it is the
  ADR's headline consequence); `basic-pluralize.spec.ts` green in en and de; tier census unchanged from the iteration baseline
  (the component must stay Folded); parity green across both surfaces.

- [ ] LT-251: Delete the per-category machinery — `truc:case`, pruning, `pluralCategories`, the dotted-key rule, the census reachability carve-outs. **Depends on LT-250 and LT-252 (nothing may still author the retired vocabulary when this lands).**
  **Skill:** le-truc-dev
  **Context:** The deletion half of the LT-240 ruling (ADR 0030 s5/s6 amended). Survey at
  ruling time: **86 references across 25 non-generated files.** Not all are deletions — count
  it as the touch set, not the win.
  - **Vocabulary:** `truc:case` / `truc:case-type` out of `classify-attributes.ts`, `ir.ts`,
    `validate-lowered.ts`, `registry.ts`, `runtime.ts`, `assemble-ir.ts`, both front-end
    lowerings, and both surface profiles (`frontend/tsx/host-profile.d.ts`,
    `frontend/tsrx/globals.d.ts`).
  - **Pruning:** ADR 0030 s6's per-locale alternative pruning in `emit-server.ts` and its
    `pluralCategories` plumbing — including the cardinal∪ordinal union fallback, which has no
    successor because the pattern states which type is in play.
  - **Census:** the reachability carve-outs in BOTH walks (the LT-190 missing/stale direction
    and the LT-217 orphan direction), and the registry's case-type input to them. Every locale
    now carries the same key set; an orphan is unconditional.
  - **Shape rule:** the `<key>.<category>` convention and its CLDR-category validation;
    **LTC008 retires** (LT-189 item 2 withdrawn accordingly). Retirement runs
    `tech-writer`'s `workflows/error-message-lifecycle.md` in full — keep-member treatment in
    the `DiagnosticCode` union per LT-223, and sweep
    `.agents/skills/le-truc/references/errors.md`, HOST_PROFILE.md and LE_TRUC_COMPILER.md.
  **Docs:** the authoritative documents were swept on 2026-09-24 (HOST_PROFILE.md,
  LE_TRUC_COMPILER.md, SERVER.md, ADR 0032/0041). Still owed here: `CHANGELOG.md`
  [Unreleased] drops its `truc:case` and per-category-key Added entries (the feature
  never ships), via `changelog-keeper`.
  **Check:** `grep -r "truc:case\|pluralCategor\|caseType"` over non-generated sources returns
  nothing outside the retirement notes; no fixture still pins per-locale pruned markup; gates
  green; warning baseline 0.

- [ ] LT-253: MF2 migration insurance — round-trip fixtures and the documented rebaseline procedure. **Depends on LT-252.**
  **Skill:** le-truc-dev
  **Context:** ADR 0030's Alternatives records MF1 as a deliberate bet with a kept-open exit:
  `@messageformat/icu-messageformat-1` parses MF1 into the MF2 data model and `messageformat@4`
  serializes it, both from the same maintainers. The bet is only cheap if the exit is *tested*
  rather than asserted. Cost grows with pattern and locale count, so build the harness while
  the corpus is one component.
  - A test that walks every corpus pattern MF1 → MF2 → renders both → asserts identical output
    for a matrix of argument values across all six locales. This is the claim "the migration is
    mechanical," turned into a gate.
  - Pin the two known-lossy spots explicitly: **nested-to-flat arm expansion** (MF1 nests
    plural-inside-select; MF2 uses one flat multi-selector, so arms multiply out — semantically
    identical, textually larger) and **escaping** (MF1 `'{'` quoting vs MF2 `|literal|` /
    backslash — where codemods go subtly wrong). At least one fixture per spot.
  - Write the rebaseline procedure down beside the fixtures, citing LT-252's commit as the
    precedent: one commit, sources + translations + manifest together.
  **Check:** the round-trip suite is green and is wired into `bun test server/tests`, so an MF1
  pattern the exit cannot carry fails at authoring time rather than at migration time.

### Client channel (after LT-250; LT-249 lands with LT-219)

- [ ] LT-218: The client-message `i18n` attribute — compiler analysis, server emission, client evaluator preamble (ADR 0030 sub-design 9). **Depends on LT-250.**
  **Skill:** le-truc-dev
  **Sequencing (re-ruled 2026-09-19):** two gates, one now discharged. Land the P2b
  SurfaceAdapter consolidation (**LT-233**) first — it collapses the two copied front ends this
  task must edit in lockstep. The **LT-240** message-model gate is **resolved** (owner ruling
  2026-09-19, ADR 0030 amended): the grammar is ICU MessageFormat 1, and the serialization
  shape is **the build-parsed AST**, not the raw pattern and not a compiled function. Land
  **LT-250** (the parser, the shared evaluator, the server fold) before this task — it supplies
  the AST shape this task serializes and the evaluator this task inlines.
  **Context:** Implements the LT-197 ruling. Three pieces; both authored surfaces stay in
  lockstep (ADR 0032 anti-drift) — the classification lives in the shared analysis, the
  per-front-end diagnostics as today.
  1. **Analysis:** admit `t.<key>` reads in client positions — event handlers, reactive
     thunks, `truc:html` thunks, expose get/set, `defineMethod` bodies, pass get/set — the
     positions the server-only name diagnostic rejects today. Literal/static keys only; a
     computed `t[dynamicKey]` stays rejected (tier Prevented). `lang` stays server-only, its
     message pointing at `host.lang`. The `t` face of the server-only rejection retires for
     these reads — a false-negative removal from an existing check, no new error class
     (retirement sweep is LT-220's).
  2. **Emission:** when the component's client-referenced key set is non-empty,
     `emit-server.ts` appends `attr('i18n', JSON.stringify({ …picked… }))` to `rootParts` —
     the materialized-`lang` precedent — evaluated per render call, so each locale bakes its
     own **parsed patterns** and compose-graph inheritance applies unchanged. An
     argument-less message serializes as a plain string (unchanged); a message with
     arguments serializes as LT-250's compact AST. Only client-referenced keys (owner
     ruling): a server-folded key never rides the attribute. The root-attribute exclusion
     covers LTC039; authored `i18n` attributes are already rejected in classify-attributes.
  3. **Client preamble:** the generated client factory gains an inlined, guarded
     `JSON.parse(host.getAttribute('i18n'))` merged over the declared source-locale record,
     which the compiler emits already parsed for the same keys — NO new `@zeix/le-truc`
     export (ADR 0030 s8). Alongside it the compiler inlines **LT-250's evaluator, narrowed
     to the constructs this component's patterns actually use** — an interpolation-only
     component gets a concatenation; `Intl.PluralRules(host.lang)` does category selection;
     nobody pays for `select` or date formatting unless used. No ICU parser on the client,
     no `eval` (CSP-clean). Client-position `t.key` reads rewrite to the local; a call site
     is validated by LT-250's diagnostic. Parsed once at connect, fixed for the connection;
     malformed JSON warns in DEV_MODE and falls back to the source record in production.
  **Pins:** the attribute carries only client-referenced keys (a folded-only key stays off
  it); absent when the set is empty (a component without client-evaluated messages renders
  byte-identical — pin one); a de render bakes translated **parsed** patterns into the
  attribute; the inlined evaluator is narrowed (a component with no plural message emits no
  `Intl.PluralRules` call — pin by fixture);
  parity green with identical attribute bytes across both surfaces; a client-created
  instance (attribute stripped) falls back to the source record (jsdom pin); the DEV_MODE
  malformed-attribute warning pins.
  **Acceptance:** tier census unchanged from the iteration baseline and compile-warning baseline 0 unchanged (client keys
  are not a routing signal); gates green (typecheck, `bun test server/tests`, check:tsrx,
  build:docs, check:links). Corpus snapshots should not move yet — no corpus component has
  client-position `t` reads until LT-219; pin via fixtures.

- [ ] LT-219: Corpus adoption — tokenbox + colorgraph event-time strings; retire the carrier-span idiom; census placeholder check. **Depends on LT-218.**
  **Skill:** le-truc-dev
  **Context:** The corpus's event-time strings (LT-195's survey; ADR 0030 s9):
  - **form-tokenbox**: declare `added`/`removed`/`duplicate` message patterns
    (`'Added token: {token}'`, `'Removed token: {token}'`, `'{token} is already in the
    list'` — the duplicate-validity message is user-visible via `setCustomValidity`; the
    platform's own `validationMessage` reads stay as-is, browser-localized); route the two
    status-region writes and the duplicate `setCustomValidity` through `t.<key>({ … })`.
    The header's "deliberately NOT here" comment shrinks to the validationMessage note.
  - **form-colorgraph**: `outOfGamut` key; the three `setCustomValidity('Color out of
    gamut')` sites route through `t.outOfGamut`.
  - **form-spinbutton**: retire the hidden `.increment-label` carrier span — the thunk reads
    `t.increment`/`t.decrement` directly (the LT-195 interim idiom, superseded by ADR 0030
    s9; owner ruling: retire in this landing). The keys become client-referenced; the span
    and its read-back die.
  - `i18n:sync` records the new keys; de gains real translations with placeholders
    preserved („Token hinzugefügt: {token}" shape); extend the i18n.test.ts de fixture pins
    to the attribute + patterns.
  - **Census pattern-integrity walks (ADR 0030 s5, re-ruled 2026-09-19):** two new
    `TranslationGap['status']` cases, both report channel — not warnings, translator-paced,
    same reasoning as missing/stale/orphaned; Tech Writer owns wording, batch with LT-189
    item 8. (a) **argument preservation** — a translation whose argument set differs from the
    source pattern's; (b) **plural-arm coverage** — a translation whose `plural` arms do not
    cover `Intl.PluralRules(lang).resolvedOptions().pluralCategories`. A third case,
    **unparseable pattern**, falls back to the source pattern and reports — it must NOT fail
    the build (a translator typo cannot make a locale unbuildable; same ruling as a missing
    key). `i18n:sync` flags all three and can auto-fix none. Follow the LT-196 pattern for the
    inverse-walk tests: falsification probes over the real catalogs, injectable for units.
    **Note this replaces, not extends, the deleted reachability carve-outs** (LT-251) — the
    census gets simpler in shape, not smaller in line count.
  **Verification:** payload pinned — the sim-driver tokenbox snapshot carries the
  attribute, asserted to stay in the low hundreds of bytes (the ADR's measure); translation
  census 0 gaps on the real corpus with the placeholder walk live; tier census unchanged from the iteration baseline;
  warning baseline 0; Playwright tokenbox spec green (status strings announce in en/de);
  gates green (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links).

- [ ] LT-249: Report non-string catalog values — a malformed `i18n/<locale>.json` entry is silent in both the census and sync (LT-217 review falsification). **Survives the LT-240 ruling, and grows a sibling:** ICU adds a second malformed-value class (a string that is not a parseable pattern), handled in LT-219 — land them as one `malformed` family with consistent copy, and drop the "LT-219 placeholder precedent" phrasing below for LT-219's argument-preservation case.
  **Skill:** docs-server-dev
  **Context:** Found by accident during the LT-217 review (2026-09-18): a catalog entry whose
  value is not a string — probed as a nested group, `{"basic-pluralize": {"stray.few":
  "wenige"}}` instead of the flat compound `"basic-pluralize.stray.few"` — is silently ignored
  everywhere: the translation census reports **0 gaps**, `i18n:sync` reports nothing and prunes
  nothing, and the entry sits in six catalogs forever. This is the silent-wrong-answer class in
  the exact channel (LT-196's) built to make catalog data problems loud, and the shape is
  realistic: a hand-editor nesting "under the component" is the most natural mistake there is.
  **Channel and tier (ADR 0028 s1):** the **build report / translation census**, tier **not
  applicable — a report, not an error**, same posture as missing/stale/orphaned: a catalog is
  DATA, the build never fails on it, and the compiler has no jurisdiction. Tech Writer owns the
  census wording (batch with LT-189 item 8's family).
  **How:** in `collectI18n`'s orphan walk (and the declared walk where values are read), a key
  whose value fails `typeof === 'string'` pushes a census record (new `TranslationGap['status']`
  case or reuse `orphaned` with a distinct reason — Architect's call at pickup; a distinct
  `malformed` case reads better). `i18n:sync` lists malformed entries in its summary and
  **cannot auto-fix** (it must not guess a shape — follow the LT-219 placeholder precedent).
  **Falsification probe to pin:** plant a nested-group value in a scratch catalog; census
  reports it; sync lists it unpruned; the flat twin behaves as today.
  **Acceptance:** the probe above pinned over the real catalogs with injection (LT-196 test
  pattern); committed catalogs stay gap-free; census/sync summaries unchanged when all values
  are strings.

### Copy (after LT-219)

- [ ] LT-220: Docs round for the ICU message model and the client-message channel — HOST_PROFILE, compiler doc, diagnostic sweep, CHANGELOG. **Sequence with or after LT-189 (batches into its one-voice copy round); scope widened 2026-09-19 by the LT-240 ruling.**
  **Skill:** tech-writer
  **Context:** The copy/docs obligations ADR 0030 s4/s5/s6/s9 leave behind; the error-message
  lifecycle applies (diagnostic faces retired, new TSRX codes gained).
  0. **The message model itself** (new, LT-240): messages are ICU MF1 patterns; `t.key` is a
     string or `t.key({ … })` a call; plurals/`select`/inline formatting live in the pattern.
     The per-category key convention and `truc:case`/`truc:case-type` are **retired** — remove
     their teaching outright rather than deprecating it, and state the replacement for exotic
     variance (a ternary, or `@if`/`@switch`). Teach the per-key typing (LT-308, ADR 0030 s4
     amended 2026-09-25): `as const` on the declaration, `I18n<typeof i18n>` on the parameter,
     and the escaped-brace caveat. The earlier "do not rely on the wider type" caveat is
     withdrawn; it must not appear.
  1. HOST_PROFILE.md: the i18n section re-taught — client-position `t` reads, the root
     `i18n` attribute carrying parsed patterns, and the `t.key({ … })` call syntax; the
     carrier-span idiom's teaching REPLACED (superseded, not deprecated — remove the LT-195
     interim guidance, point at ADR 0030 s9).
  2. LE_TRUC_COMPILER.md: the classification (client positions, literal keys only), the
     emission point, the census paragraph's two pattern-integrity walks, and the removal of
     the pruning/`pluralCategories` description.
  3. The retired `t` face of the server-only diagnostic: sweep
     `.agents/skills/le-truc/references/errors.md` and any prose teaching "`t` is
     server-only" — the retirement counts per the lifecycle.
  4. Final copy: the pattern-placeholder TSRX code (drafted in LT-218), the census
     placeholder-mismatch wording (drafted in LT-219), the computed-`t[dynamicKey]`
     wording if split from the generic message. Batch with LT-189 items 2–8.
  5. CHANGELOG `[Unreleased]` Added bullets (client-string channel, patterns, census
     check); an AGENTS.md "Surprising Behaviors" i18n bullet if the changed `t`-in-thunk
     rule warrants one.
  **ADR 0037 rider (2026-09-21):** this round also carries the branch-DOM-lifetime copy —
  the HOST_PROFILE control-flow table row and the arrow-thunk section's reversal, the
  ARCHITECTURE/AGENTS "`@if` cannot read signals" sentences, and the new construct's
  teaching ([ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)).
  **Check:** `check:links` after doc moves; errors.md's entry inventory matches the
  diagnostics union (code added, none deleted — the `t` face was message scope, not a
  code).

- [ ] LT-189: Tech Writer round — `ContextRequestEvent` cross-realm docs plus the standing i18n copy handoffs.
  **Skill:** tech-writer
  **Context:** Three copy items queued from landed work; batch them so the messages read as
  one voice. All follow `workflows/error-message-lifecycle.md`.
  **S0 hold — RESOLVED 2026-09-19 (LT-240 ruled: ICU MF1).** Consequences for the held items:
  **item 2 is WITHDRAWN** — the dotted-key CLDR shape rule is deleted by LT-251, so LTC008's
  message is retired rather than reworded; the retirement still runs the error-message
  lifecycle sweep (that is LT-251's obligation, verified here). **Item 8 proceeds**, with one
  amendment: the orphan census/sync copy must no longer reference reachability or plural
  categories — every locale now carries the same key set, so an orphan is unconditional.
  LT-219's census wording is no longer "placeholder preservation" but the three cases in that
  task (argument preservation, arm coverage, unparseable). The non-i18n items (1, 3–7, 9, 10)
  were never held.
  **ADR 0037 rider (2026-09-21):** batch item — the LTC005 condition-face retirement message
  and [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)'s new codes join
  this round's one-voice copy handoffs (drafted in LT-275).
  1. **`ContextRequestEvent`'s cross-realm dispatch** (LT-180 review finding):
     `requestContext()` now builds the `context-request` event from the HOST's own realm
     whenever the exported class does not belong to it (`src/helpers/context.ts`, LT-180).
     The class stays exported and unchanged, and in the normal same-realm case it is still
     what gets dispatched — but in a cross-realm host (an iframe, the build's simulation
     realm) the dispatched object is a duck-typed `Event` carrying
     `context`/`callback`/`subscribe`, so a provider written as
     `if (e instanceof ContextRequestEvent)` would stop matching. This is
     protocol-conformant — the Web Components Community Protocol specifies the event's
     fields, not its class, and Le Truc's own `provideContexts()` reads the fields — so it
     is a documentation gap, not an ADR question (Architect ruling, 2026-09-06). Scope: the
     JSDoc on `ContextRequestEvent` and on `requestContext()`, plus the context section in
     `docs-src/pages/` and the `le-truc` skill's context reference. One rule to state: a
     provider checks `event.context`, never `instanceof`.
  2. ~~**LTC008's dotted-key message** (LT-190 handoff)~~ — **withdrawn 2026-09-19.** The
     rule the message documents (a dot-suffix must name one of the six CLDR categories) is
     deleted by the LT-240 ruling; the code is retired in LT-251, which owns the lifecycle
     sweep. Nothing to word here.
  3. **LTC047's literal-prose warning** (LT-173 handoff): final copy; the single-letter
     exemption (page data, not prose) must survive the rewording, and the missing-
     *translation*-rides-the-census distinction is the point of the message.
  4. **LTC048's duplicate-tag error** (LT-202 handoff): final copy over the draft in
     `server/compiler/diagnostics.ts` — one tag, two corpus sources, both files named; the
     "whatever surface it is written in" clause is the dual-front-end fact the message
     teaches.
  5. **The `<truc:try>` diagnostic wordings** (LT-202 handoff, amended by LT-211/208,
     respelled by LT-303 on 2026-09-25): in `server/compiler/frontend/tsx/lower-tsx.ts`,
     the one surviving arm-shape error (LTC005: arms inline, `catch` an arrow with a JSX
     body, no other attributes) and the content/pending/catch single-root wordings.
     The `boundary()` and try/catch-IIFE wordings are retired, so check that nothing in
     `.agents/skills/le-truc/references/errors.md` or `docs-src/pages/` still quotes them.
     Also word LTC053 for a `<truc:try>` used as a `.map()` output root. It currently says
     "not a static element name" and suggests a ternary, but the real rule is that a loop
     body root must be an element (`.tsrx` rejects `@try` there too). The copy also covers
     LT-209's LTC049/LTC050 drafts in `server/compiler/diagnostics.ts`. Batch with items 2–3 so the diagnostic families
     read as one voice.
  6. **The TSRX020 retirement copy** (LT-210 handoff, 2026-09-18): the retirement note
     in `server/compiler/diagnostics.ts`'s code union, TSRX018's reworded fix-it
     (`&{`/`&[` no longer introduce anything under the 0.2 pin — drafted, final copy
     owed), and the propagation sweep the retirement leaves behind (per
     `workflows/error-message-lifecycle.md`): HOST_PROFILE.md's lazy-destructuring
     section, LE_TRUC_COMPILER.md §106/§184, and `.agents/skills/le-truc/references/errors.md`
     were updated in the bump commit — verify voice consistency across them. Batch
     with items 2–5.
  7. **The LT-215 reactive-list body diagnostics** (2026-09-18): `validateListBody` in
     both front ends reworded — the admitted server-static class dropped the
     "milestone-3 subset" phrasing for a statement of what the slot-fill contract
     actually reserves (per-item values), and the rejections now name the offending
     reads (`reads item, which derive per item or client-side`). The stale `&{item}`
     sigil spellings in the touched messages modernized to `{item}`. Final copy over
     the drafts in `frontend/tsrx/lower-template.ts` and `frontend/tsx/lower-tsx.ts`;
     batch with items 2–6 so the compiler families read as one voice.
  8. **The LT-196 orphaned-key copy** (2026-09-18): the census reason line in
     `server/compiler/sim/report.ts` (first draft: `orphaned — nothing in the corpus
     declares this key; the entry can never render` — a report record like
     missing/stale, so the wording names the subject, the fact, and stops; census
     records never carry fix-its) and the sync summary line + header step 3 in
     `scripts/i18n-sync.ts` (first draft: `N orphaned key(s) PRUNED — nothing in the
     corpus declares them, so they could never render`). Propagation sweep per
     `workflows/error-message-lifecycle.md`: HOST_PROFILE.md's census sentence,
     LE_TRUC_COMPILER.md's census paragraph, and the CHANGELOG Added bullet must
     read as one voice with the final wording. **Sequence with LT-217**, which
     narrows the carve-out to declared keys and rewords the sync header step 3 and
     the ADR 0030 s5 orphan-direction sentence itself — run item 8 after it (or
     accept a second pass over those two spots).
  9. **The `class:`-prefix rejection copy** (LT-222 handoff, 2026-09-18): the new
     LTC006 reason in `server/compiler/classify-attributes.ts` (first draft:
     "`class:token={…}` is not a TSRX spelling — a per-class reactive binding is a
     class map: `class={() => ({ token: value })}`. A `class:token` attribute
     renders into the markup verbatim and the browser ignores it."). No new code —
     the existing malformed-attribute channel carries it — but the copy is new, and
     both prior spellings were SILENT, so the fix-it line is the load-bearing part.
     Batch with items 2–8.
  10. **The union restructure** (LT-223 handoff, 2026-09-18): retirement treatment
     standardized to the keep-member form the lifecycle doc prescribes — `TSRX020`
     is a kept member again (was deleted-with-comment, the file's one outlier),
     `LTC031` keeps its member with an expanded note, and `LTC004`/`013`/`043`
     left the `DiagnosticCode` union for tier.ts's named `RoutingSignalOrigin`
     (they are census origins, not emitted codes; position comments mark where the
     numbers are spent). Check `.agents/skills/le-truc/references/errors.md` and the
     lifecycle doc itself still describe the treatment accurately.
  11. **The `swapSlots` failure-reason rewording** (LT-178 handoff, moved here from the
     DONE.md entry 2026-09-21): final copy for the reworded `InvalidPassPropertyError`
     reason ("could not be resolved to a signal — pass() accepts a thunk () => … …"),
     the CHANGELOG `[Unreleased]` Removed entry's wording, and the `errors.md`
     `InvalidPassPropertyError` row — its "unresolvable to a signal" condition now also
     means "retired form" (property-key and bare-signal forms, including bare read-only
     `Memo`/`Task`), and the fix-it column may name the accepted forms.
  12. **The LTC005 builder rewording** (LT-300 handoff, 2026-09-25): `diagnostic.unsupported`
     now ends "… is outside the supported subset (ADR 0023)." plus an optional `fix`
     sentence; the stale "sanctioned milestone-2 … Supported:" list is gone from every
     LTC005 message. Owed: the `errors.md` LTC005 row ("sanctioned subset" → "supported
     subset (ADR 0023)"; fix column "Apply the fix the message names; where it names none,
     rewrite with a supported construct"), which the LT-300 session could not write
     (sandbox). The CHANGELOG `[Unreleased]` line landed on 2026-09-25. The ~90 other
     `unsupported` call sites pass no `fix` yet; moving their inline "— explanation" fixes
     into the `fix` argument is in scope for this batch's one-voice pass.
  13. **LTC046's position wording** (LT-108 review, 2026-09-25): the message says a const's
     value "is rendered into this component's markup". The position that tripped it in
     module-carousel was an `expose()` initializer, which the server module evaluates. Name
     the position, or say "evaluated by the server render", so the author looks in the right
     place.
  14. **The context-key module pattern** (LT-106 review, 2026-09-25): `docs-src/pages/context.md`'s
     consumer snippet imports `MEDIA_MOTION`/`MEDIA_THEME` from `context-media`. The keys now
     live in `examples/context/media/media-contexts.ts`. Point the snippet there and state the
     rule (Architect ruling, LT-106, recorded in DONE.md): a provider's context keys live in a module with no side
     effects, never in the component module, because importing a component module defines the
     element.

### Parallel slot

- [ ] LT-138: The `truc:html={}` sanitizer default is inverted between server and client (LT-128 verification finding). ~~**Gated: deferred until a component actually authors `truc:html`; none does today.**~~ **[2026-09-25] Gate tripped:** module-splitview.tsx (LT-102) authors static `truc:html={start}`/`{end}`, and no build path calls `configureHtmlSanitizer`, so a server-composed splitview renders its panes as escaped text. The static form never binds client-side, so it shows no flip yet; the reactive form's flip is still unverified. Promote with the next iteration.
  **Skill:** le-truc-dev
  **Context:** The two halves of one `.tsrx` source disagree on the default trust posture:
  `server/compiler/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
  entities, so nothing ever renders — safe but inert), while the client's
  `dangerouslyBindInnerHTML` (`src/bindings.ts:652`) ships NO sanitizer and assigns raw unless
  `configureHtmlSanitizer()` was called. Both are configurable and both document themselves as
  "the library owns no sanitizer", but the DEFAULTS point opposite ways. For a reactive
  `truc:html={() => …}` that means an unconfigured app server-renders escaped, inert text and
  then flips to live markup on hydration — a visible content change and an inconsistent security
  posture from one authored attribute. **Unverified:** no corpus component authors the
  attribute, so this has never run end to end; confirm the flip with a fixture before designing
  the fix. **Decide** which default is right, then make both halves agree, and make
  `configureHtmlSanitizer` on one side not silently leave the other unconfigured.
  **One sanitizer serves both channels (settled by LT-152, 2026-09-03).** jsdom is in the build
  regardless of tiering, and DOMPurify's documented Node path
  (`createDOMPurify(new JSDOM('').window)`) was verified on it against two hostile payload sets.
  So: DOMPurify server-side through `configureHtmlSanitizer`, DOMPurify client-side, and
  `sanitize-html` retires. That matters beyond tidiness — two sanitizers with different
  allowlists mean a `truc:html` value that survives the server's filter can be altered by the
  client's at connect, i.e. a hydration diff in the one place a hydration diff is a security
  question. The retirement is small: `sanitize-html` was never a production dependency
  (`configureHtmlSanitizer` is called only from `server/tests/compiler/features.test.ts:25`).
  **ADR 0010's policy is untouched** — the library still ships no sanitizer and the consumer
  still supplies the hook; this is about what the compiler runtime is configured with and what
  the docs recommend.
  **Target state (owner, 2026-08-31): seamless Trusted Types.** The API is Baseline 2026 and the
  client half is already shaped for it — `Sanitizer` returns `string | TrustedHTML` and
  `dangerouslyBindInnerHTML` assigns through a cast a Trusted-Types-enforcing CSP accepts
  (`src/bindings.ts:35`, `:682`). The blocker is TypeScript's DOM lib and it has NOT lifted:
  `lib.dom.d.ts` in the installed TS 6.0.3 still has no `TrustedHTML` interface, which is why
  `src/bindings.ts:32` carries a local `type TrustedHTML = object` placeholder. **Unverified:**
  whether TS 7 fixes it — the published `typescript@7.0.2` tarball ships no `lib.dom.d.ts` in
  the old layout, so check against however TS 7 delivers its DOM lib before planning. Two things
  follow if it has landed: drop the placeholder for the real type, and decide whether the SERVER
  half gets a Trusted-Types-shaped seam too (it produces strings into markup so it cannot hold a
  `TrustedHTML`, but it can share one policy-configuration entry point with the client so an app
  configures trust ONCE rather than per environment — which is the actual fix for the
  inverted-defaults problem).
