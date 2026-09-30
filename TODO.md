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
  Tech Writer round (seventeen items, one withdrawn). The two run as one round, last, so the new ICU codes
  join it.
- **Parallel slot.** **LT-138** was promoted by the LT-102 review. module-splitview authors
  `truc:html`, so the inverted sanitizer defaults are now live in the corpus. Its first step
  is the fixture that confirms the flip.

**Order (re-ruled 2026-09-26).** LT-242 → LT-233 → LT-250 → LT-308 → LT-347 → LT-348 → LT-218 →
LT-252 → LT-251. LT-253 after LT-252. LT-218 → LT-349 ✓ → LT-219 ✓ (LT-249 follows); LT-350 before
LT-219 where possible. basic-pluralize's single
pattern re-evaluates when `count` changes client-side, and only LT-218's channel can do that,
so LT-252 now waits for it. LT-347 closed the compiler gap LT-218 would otherwise build on. LT-348 removes the false positives it introduced. LT-220 and LT-189 run as one Tech Writer round after
LT-219, as LT-220's header asks. LT-138 is ungated (LT-346 ✓). LT-351 (Architect) ruled 2026-09-30 → LT-354 ✓ (LT-352 follows it) and LT-355 (backlog).

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

**Next free task ID: LT-357.**

---

### Gates (run first)

### Build half (LT-250 → LT-308 → LT-218 → LT-252 → LT-251; LT-253 after LT-252)

### Client channel (after LT-250; LT-249 lands with LT-219)

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
     withdrawn; it must not appear. basic-pluralize's JSDoc lead still says "plural forms of
     content". Since LT-252 it renders its own noun (`tasks`) from the catalog, with no
     page-supplied word forms, so re-word the lead and its docs page (`basic-pluralize.md` was
     updated in LT-252; check it against the one-voice rules).
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
     rule warrants one. Also two stale clauses LT-251's review found in existing bullets.
     The LT-195 bullet teaches spinbutton's hidden `.increment-label` span as "the
     rendered-alternatives idiom, ADR 0030 sub-design 6", but LT-219 removed that span and
     s6 now says the opposite. The "Host-derived folds" bullet's "lets an i18n component's
     plural category fold" names basic-pluralize's deleted `pluralCategory` helper, so keep
     the colorgraph example as the reason.
  6. **LT-253 review riders (2026-09-26).** (a) `i18n/README.md` still teaches the retired
     per-category dotted keys (`basic-pluralize.task.one`) and the census reachability rule.
     Re-teach it as one ICU pattern per key, where each locale spells only its own arms. (b)
     `server/tests/compiler/MF2_EXIT.md` rebaseline step 4 overclaims: "only the serialized
     `i18n` attribute changes" holds for the *data*, but the migration also replaces the MF1
     parser adapter, the evaluator, the per-key arg-kind types (LT-308) and the pattern
     diagnostics. Scope the procedure to the data rebaseline and name the compiler swap as its
     own precondition, outside the one commit.
  7. **LT-354 riders (2026-10-01).** HOST_PROFILE's client-channel paragraph and CHANGELOG
     `[Unreleased]`: the attribute carries only keys the render locale changes, so a
     source-locale render usually writes none; serialized messages carry no locale; the root
     `lang` is the client's only locale source, and the compiler writes it on a component whose
     client messages format (number, date, plural) but that binds no `lang`. HOST_PROFILE's
     "a client-created instance speaks the source locale" stays until LT-355 lands.
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
  **item 2 is WITHDRAWN** — the dotted-key CLDR shape rule is deleted by LT-251, so its
  message under LTC008 is gone rather than reworded. **LTC008 itself survives** (LT-251
  review, 2026-09-26): it is the general source-shape code, and the dotted-key rule was one
  of its messages, so there is no retired code and no sweep to verify. **Item 8 proceeds**, with one
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
     deleted by the LT-240 ruling, and LT-251 deleted that message. LTC008 stays for its
     other source-shape messages. Nothing to word here.
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
     **LT-249 rider (review, 2026-10-01):** the same family grew a non-string class.
     `malformed`'s census reason in `server/compiler/census.ts` was reworded to cover
     undeclared keys (first draft: `malformed — the entry is not a valid ICU pattern and
     never renders; a declared key falls back to its source-locale string`). Its new
     detail in `collectI18n` (`not a string — found a nested group; catalog keys are flat
     \`<tag>.<key>\` compounds`) ends in a fix-it, which is against this item's "census
     records never carry fix-its" posture. Decide whether the clause stays as a
     detail-only hint or goes. The sync FLAGGED summary line (`malformed (unparseable or
     not a string)`) is in scope too.
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
  15. **The surface vocabulary** (LT-233 handoff, 2026-09-25): `server/compiler/surface.ts` is
     now the one place shared compiler code takes surface-specific wording from — review it as a
     vocabulary, both tables side by side. Every `.tsx` value is first-draft copy (it replaced
     `.tsrx` spellings `.tsx` authors used to be shown), and ~40 messages in
     `analysis/effects.ts`, `analysis/loops.ts`, `lower-shared.ts` and five `diagnostics.ts`
     builders (LTC001, LTC002, LTC027, LTC035, `loopInBranch`) compose from it. Settle the
     noun set for conditionals (`thenBranch`/`elseBranch` read "first/second conditional arm"
     on `.tsx`) before the phrasing; LTC002 is now surface-neutral ("loop variables").
     `server/tests/compiler/tsx/diagnostic-parity.test.ts` pins parity, so rewording a key needs
     no test edit unless a sentence frame changes. `errors.md` rows for LTC001/LTC002/LTC027/
     LTC035 follow the reworded text.
  16. **LTC055's copy** (LT-250 handoff, 2026-09-26): two first-draft builders in
     `diagnostics.ts` — `unparseableMessage` (a source pattern that is not a supported ICU MF1
     pattern; the parser's own reason is spliced in) and `messageArgumentMismatch` (a `t.<key>`
     site: missing/extra arguments, a non-literal record, an argument message read bare, an
     argument-less message called — the clauses live in `i18n.ts`'s `reportMessageCallSites`).
     New code, so `errors.md` gains an LTC055 row. Pinned by `i18n.test.ts` and three
     `diagnostic-parity.test.ts` cases (sentence fragments, not whole messages).
  17. **LTC005's server-only face** (LT-347/LT-348 handoff, 2026-09-26): one helper,
     `reportServerOnlyNames` in `analysis/effects.ts`, now writes the sentence for every client
     position: "<subject> references server-only name(s) … ; <tail>". The first-draft subjects
     are `Reactive text on <tag>` / `on the component root`, `Reactive class map`, `Reactive
     style map`, `Event handler \`onX\``, `expose() entry \`p\`` and `Setup const \`x\`, emitted
     client-side because a client position reads it,`. Attribute, `truc:html` and pass entry
     keep their wording. `Signal \`c\`` joined with LT-348. LT-348's first-draft tail: "those
     exist only during the server render — read the value through an exposed prop or from the
     DOM". That advice is wrong for a module-level declaration (`function helper()` read in
     a handler). There the fix is to move it into setup or import it from a module, so the
     tail may need to branch on the binding class. LT-349 moved the two `loops.ts` list-body
     messages onto the same frame; their subjects now read `<subject> inside the <loop> body` and
     `<subject> inside a reactive-list <loop> body`, and the `listHandlerNames` wording key is
     gone with the old tail. Settle the subject set and the tail together.
     LT-218 adds two first drafts: the `lang` fix-it sentence ("The locale is `host.lang` on the
     client, not `lang`.") and the generated client's DEV_MODE warning ("<tag>: the i18n
     attribute is not valid JSON — using the source-locale messages"). The
     parity suite pins sentence fragments (`SERVER_ONLY` pins), so a reworded subject means
     editing the pins. `errors.md`'s LTC005 row gains the server-only face.

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
