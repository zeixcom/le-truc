# TODO

Prioritized task queue, highest band first. Within a band, work top to bottom unless a task
names its own dependency.

**Where the history went.** Everything landed and reviewed has been removed from this file
(architect, 2026-09-06). The rationale for what shipped lives in `adr/` (0024, 0026–0030),
`ARCHITECTURE.md`, `server/tsrx/LE_TRUC_COMPILER.md` and `TSRX-HOST-PROFILE.md`; the
user-facing summary lives in `CHANGELOG.md` `[Unreleased]`; the task-by-task record lives in
`git log -p -- TODO.md`. Do not re-derive a decision from a task entry — read the ADR.

**Standing framing** (ADR 0029, accepted 2026-09-04). Server evaluation is three tiers:
**Folded** (phase 1 resolves it; string folding, no jsdom), **Simulated** (phase 1 cannot
complete AND the realm can answer; pre-played in jsdom), **Static** (neither; static skeleton,
the client corrects at connect). Tier is per **component**; unresolvability is per
**expression** — an impure ambient read (`Date.now()`, `Math.random()`) is omitted in every
tier and is not a routing signal. The compile-warning baseline's target is **zero**: routing
signals ride the tier census on `sim/report.ts`, not the diagnostic channel. Judge a migration
on zero warnings *plus* its recorded tier and reason.

**Next free task ID: LT-188.**

---

## P0 — Format spike (gates P5; parallel-safe with P1/P2)

- [ ] LT-183: TSX surface spike — decide `.tsrx` vs `.tsx` compiler surface. **Plan: `TSX_SPIKE.md`.**
  **Skill:** le-truc-dev
  **Context:** The 2026-09-06 architecture review concluded the compiler machinery
  (analysis, emitters, simulation, tiering) is format-independent while the surface
  (`.tsrx` grammar on a pinned `@tsrx/core`) carries the mounting costs: broken editor
  support, the React-near-miss diagnostic family, pin churn, emit-then-check type flow.
  A time-boxed spike on branch `spike/tsx-surface` re-targets the compiler front end onto
  the TypeScript parser (stand-alone core; no Babel; `sim/` stays out of its import
  graph — decisions §2 of the plan) and ports `basic-counter`, `basic-pluralize`,
  `form-combobox` + `form-listbox`, diffing server renders **byte-wise** against the
  existing `.tsrx` goldens. §7 records probe-verified facts (TS 6.0.3 parses and
  type-checks `truc:pass` namespaced JSX attributes; function-valued attributes and IIFE
  arms check under `--strict`). **Gates wave 4:** do not start LT-095–LT-111 before the
  go/no-go — a surface switch after migrating 21 more components would double the churn.
  On GO, an ADR supersedes ADR 0024's surface sub-designs; on NO-GO, TSRX stands with
  evidence. Read the plan; it is self-contained.

---

## P1 — Tiered server evaluation — CLOSED 2026-09-06

Everything in this band landed and is reviewed: **LT-165** (the eight ADR 0029 steps),
**LT-185** (form-tokenbox's hydration regression), **LT-184** (the severe `TSRX034` scoped
per-expression), **LT-180** (library-contained connect failures reach the build report) and
**LT-169** (the simulation driver runs inside `build:docs`). Corpus split **19 Folded /
3 Simulated / 0 Static**, compile-warning baseline **0**, simulation build-report baseline
**0 unclassified**. Measured cost: the simulated build stage is ~90 ms against ~224 ms for the
whole corpus, so tiering saves ~150 ms per build today; the Static-tier saving is still 0,
because no corpus component routes Static until `module-scrollarea` migrates (LT-103). Read
ADR 0027 and ADR 0029 plus `LE_TRUC_COMPILER.md` § 5.4 for the rationale, and
`git log -p -- TODO.md` for the step record. P1's wave-4 obligations live in the P5 preamble;
P2 and P3 no longer wait on anything here.

**Review decisions worth keeping (2026-09-06).** The build pass simulates each component's
authored demo HTML (`examples/**/<tag>.html`) rather than the server render function over
fixture args — approved: the fixture args are a test artifact, the demo markup is what the docs
serve, and it keeps the build free of an args table it would have to maintain. The pass runs for
one-shot builds only — approved: one module cache per process makes a second load of the same
generated client unsound (ADR 0027 sub-design 10), and the gate belongs where CI runs it; the
cost is that a watch session never sees the gate. Capturing every host `console.error`/`warn`
during a load/render window, rather than only the library's containment messages — approved:
the console carries no marker that separates them, and `CLASSIFIED_DIAGNOSTICS` is the designed
escape hatch for anything that provably cannot affect serialized markup. LT-180's library fix
(building the `context-request` event in the host's realm) is **protocol-conformant and needs no
ADR**: the Web Components Community Protocol specifies the event's FIELDS, not its class — but
it does need documenting, which is **LT-189** in P6. The one defect the review found is
**LT-188** in P3.

## P2 — Internationalization (ADR 0030)

- [x] LT-173: Implement the reserved `i18n` parameter and the catalog pipeline. — reviewed ✓ (public-surface change: new authoring vocabulary, see handoffs)
  **Skill:** le-truc-dev
  **Review (architect, 2026-09-06):** Approved. The mechanism is ADR 0024 s10's
  reserved-parameter precedent applied once, not a second one; the census rides the
  sim/report channel so the warning baseline survives; the build's read-only posture
  held under a real end-to-end pass (six locale catalogs committed, `i18n:sync`
  manifest written by the person-run script, census 0 gaps). One finding, routed to
  **LT-190**: the component template's per-category span contents are literal
  source-language morphology (`s`), which a single-string catalog key cannot override
  — a German compose-site render reads "Aufgabe + s", a Chinese one litters a Latin
  "s" into its only form. Pinned as a KNOWN GAP fixture in
  `gate-wave-verification.test.ts` (per-locale pruning pins for de/zh/ar/pl/lv added
  in the same pass, incl. ar's ordinal set collapsing to `{other}` and Latvian's
  count=10 selecting `zero`). Also fixed during review: two standing type errors in
  `server/tests` (no script typechecked `server/` — new `check:types` script closes
  that gap). NOTES review notes resolved: the fold widening's form-colorgraph side
  effect re-verified and kept; the ancestor-walk retirement was ruled too aggressive
  the same day — **LT-191** restores inheritance (it was the components' own
  documented contract); refs into pruned alternatives stay rejected until a real
  authoring case appears.
  The TSRX047 copy handoff to Tech Writer remains open.
  **Implemented, in the task's own order.** (1) The reserved parameter: a component
  declaring `i18n` in its param pattern gets the record supplied by the compiler at every
  render call boundary — compose sites emit `i18n: i18nRecord("<tag>", <lang-expr>)`
  (`emit-server.ts`, child's registry entry carries `declaresI18n`/`langArgDefault`); a
  caller-authored `i18n` attribute at a compose site is rejected (TSRX006). Record shape per
  the ADR; `I18n` is ambient in `globals.d.ts` for sources and imported from the generated
  `./i18n` module in generated server code. (2) Precedence: compose-site `lang` arg >
  authored `lang` default > build page locale, computed at the record's construction; the
  compiler renders `attr('lang', <binding>)` on the root for an i18n component that binds
  `lang` but does not render it — **TSRX039 confirmation: no new exemption needed**, the
  root-element exclusion in `reportDuplicatedChannels` already covers both routes.
  (3+3b+4) Catalog pipeline in `server/effects/i18n.ts`: inline sources via `export const
  i18n` (string literals only — they are the fallback bytes the manifest hashes); overrides
  in `i18n/<locale>.json` (`<tag>.<key>`); staleness via a committed `i18n/manifest.json`
  (per locale per key, the source hash at translation time — a moved source string reports
  `stale`, verified live); the generated `server/generated/tsrx/i18n.ts` module; the
  gitignored `i18n-report.json`; the census rides `sim/report.ts` (`CensusKind
  'translation'`, `translationCensus`) with the count in the build summary and the full
  section in `check:tsrx`; `bun run i18n:sync` is the person-run writer (exercised end to
  end, throwaway artifacts removed — no catalogs committed until translation starts).
  (5) **TSRX047** (warning): literal prose (two or more adjacent letters) in a
  catalog-using component; single-letter fragments exempt (page data, not prose). Copy is a
  first draft — **Tech Writer owns the final copy** per
  `workflows/error-message-lifecycle.md`. (6) **The payoff verified**: the fold rule widened
  so a host-derived fold may call TRANSITIVELY-PURE setup consts
  (`foldableRenderScope`, shared by analyzer and emitter so they cannot drift) —
  `basic-pluralize` re-cut onto `i18n` classifies **Folded with zero routing signals**, the
  six standing signals dissolved; blogmeta's fold stays deferred to LT-095 as recorded
  there. Side effect, reviewed and kept: `form-colorgraph`'s `aria-valuenow`/`aria-valuetext`
  now fold at phase 1 too (same pure-const shape through `asOklch()`), shrinking its
  hydration boundary — audit snapshot re-pinned, fixed-point gate green. (7) Pruning:
  `truc:case="<category>"` marks an alternative; `truc:case-type={expr}` (once per group,
  per render call) prunes by the configured `Intl.PluralRules` type — an explicit
  `undefined` is cardinal (Intl's own default), no declaration falls back to the
  cardinal∪ordinal union; the set is read from the platform at render time
  (`runtime.ts`'s `pluralCategories`); case elements address as `'maybe'` + guarded effects,
  deeper constructs inside them rejected; **the count-change-after-connect fixture pins the
  toggles** (count 1 → 0 flips `.one` → `.other` on the pruned en set).
  **Changed:** `server/tsrx/` (`i18n.ts` new; `ir.ts`, `compiler.ts`, `diagnostics.ts`,
  `classify-attributes.ts`, `evaluability.ts`, `analysis/effects.ts`, `emit-server.ts`,
  `runtime.ts`, `registry.ts`, `index.ts`, `lower-template.ts` text-node spans,
  `sim/report.ts`, `sim/index.ts`, `globals.d.ts`); `server/effects/` (`i18n.ts` new,
  `tsrx.ts`); `scripts/` (`i18n-sync.ts` new, `check-tsrx.ts`); `examples/basic/pluralize/`
  (`.tsrx` migration, `.html` Welsh instance now carries `lang="cy"` directly); fixtures
  (`corpus-args.ts`, smoke ARGS); `i18n/README.md` new.
  **Verification:** acceptance walked item by item — record supplied with no caller change;
  authored `lang` overrides and renders as the root attribute; missing key renders the
  source string and lands in the census, never the warning stream (compile-warning baseline
  stays 0); untranslated literal warns; pluralize Folded with two category spans on an `en`
  page and correct re-selection when `count` changes after connect; the build writes only
  gitignored files; `bun test server` 1500 pass / 0 fail; `check:tsrx` clean; biome clean.

- [x] LT-175: Measure and contain the per-locale impact on LT-166's render cache (exploration). — done, pending review ⏳ (measurement + ruling; no production code changed)
  **Skill:** docs-server-dev
  **Findings (2026-09-06, measured on this checkout):**
  **The premise is stale — the corpus the ADR feared no longer reaches the realm.**
  The simulated stage today is **2 components, 4 occurrences, 4 renders, 0 cache hits, 83 ms**
  (`form-combobox`, `form-listbox`; 20 of 22 components skipped). ADR 0030's
  `~3,700 occurrences / 93.5% hit rate` is a pre-ADR-0029 figure: tiering routes the
  corpus away from the realm, and the build's pass renders authored demo markup per
  component, not page occurrences. **Neither simulated component declares `i18n`.**
  The one i18n component (`basic-pluralize`) classifies **Folded**, exactly as
  ADR 0030 sub-design 1 predicted.
  **Render cache, 1 locale vs. N** (spike over the real compiled corpus; occurrences /
  renders / hits / hit rate / wall time):

  | Variant | occ | renders | hits | hit rate | ms |
  |---|---|---|---|---|---|
  | 1 locale, no locale seeded (today) | 4 | 4 | 0 | 0% | 18 |
  | 1 locale (`en` seeded) | 4 | 4 | 0 | 0% | 19 |
  | 2 locales, locale in key | 8 | 8 | 0 | 0% | 27 |
  | 2 locales, locale-invariant key for non-i18n | 8 | 4 | 4 | 50% | 19 |
  | 4 locales, locale in key | 16 | 16 | 0 | 0% | 37 |
  | 4 locales, locale-invariant key for non-i18n | 16 | 4 | 12 | 75% | 19 |

  **At 1 locale the cache is pure overhead** — a Map write per render and zero hits,
  because the 4 occurrences are 4 distinct `(component, markup)` pairs. It only
  becomes a saving under per-locale multiplication, and only if the key drops the
  locale for components that do not consume it.
  **Split by tier:** the Folded (20) and Static (0) tiers cost the realm nothing at any
  locale count — the ADR 0029 saving holds unchanged under i18n.
  **With/without pruning: no effect on the cache, structurally.** Per-locale span pruning
  lives in `emit-server.ts` (the Folded server-render path); every component that
  prunes is Folded and never reaches a realm. This axis is empty, not small.
  **Ruling — containment is worth taking, but it is not where LT-174's cost is.**
  Key on locale only when `declaresI18n` is true; otherwise use a locale-invariant
  key. That makes the simulated stage locale-count-independent (19 ms flat vs. 37 ms at
  4 locales) for a three-line change with a checkable invariant. Land it in LT-174.
  **The figure LT-174 actually owes** (same build, instrumented per stage): phase 1
  (TypeDoc + CSS + TSRX compile) **3032 ms and locale-independent**; simulate **85 ms**;
  js 22 ms; mdMirror 41 ms; apiPages **731 ms**; pages **1544 ms** (28 pages);
  examples **1597 ms** (35 pages); total 4816 ms.
  **Correction, measured after LT-174 landed:** the projection this spike drew from those
  figures — "≈ 3.9 s per additional locale" — was **wrong by two orders of magnitude**. The
  per-stage timings are wall-clock from phase-2 start, so `pages`' 1544 ms is dominated by
  WAITING on `docsMarkdown.fullyProcessed` (Markdoc parse + transform + Shiki, computed once
  and shared by every locale); the marginal per-locale work is template application and file
  writes. Measured end to end, twice each: **1 locale 3723 ms, 2 locales 3746 ms — +23 ms for
  a whole second locale.** The stage split still correctly identifies WHERE cost lives; it
  does not license reading any stage's total as per-locale marginal cost. The conclusion the
  spike was for is unchanged and now doubly true: the render cache is a rounding error.
  **Follow-up:** ADR 0030's consequences bullet (`~3,700 occurrences`, `93.5% hit
  rate will drop`) is measurably wrong post-ADR-0029 and should be amended — flagged for
  the Architect, not edited here.
  **Check:** whether the containment invariant belongs in `realm.ts` (cache key) or at
  the `simulate.ts` call site, and whether the ADR amendment is in scope for LT-174.
  **Context:** A measurement round before designing anything — the direction of the net effect
  is genuinely unknown, which is why it is a spike and not an obligation buried inside LT-174.
  Pulling one way: per-locale rendering multiplies the corpus (~3,700 occurrences → N × 3,700)
  and LT-166's `(component, locale, markup)` memoization now varies by locale, so the measured
  **93.5% hit rate will drop**. Pulling back: ADR 0030's Folded-tier promotion means i18n
  components stop being simulated at all, and per-locale pruning (LT-173 step 7) shrinks the
  markup that is the cache key. **Measure, don't estimate:** hit rate and simulated-stage wall
  time at 1 locale vs. 2, split by tier, with and without pruning. Then decide whether
  containment is needed at all and what shape it takes (locale in the key vs. a locale-invariant
  key for components that don't consume `i18n`; the latter looks promising since most components
  won't declare the parameter, but confirm rather than assume). Record the figures in the
  handoff — ADR 0030's consequences section says explicitly that nobody has measured the net.

- [x] LT-174: Per-locale page rendering for the docs site (ADR 0030 s1). — done, reviewed
  (2026-09-15): two regressions the review caught are fixed in this commit (llms.txt now
  links the default locale's mirrors; blog avatars resolve from the docs root, tested), the
  sitemap gained `x-default`, and the raw-NUL test file is escape-encoded so its cache-key
  coverage is diffable. Minors queued as LT-198. (public-surface change: URL structure,
  output layout, server routes)
  **Skill:** docs-server-dev
  **Changed:** `server/config.ts` (`LOCALES`/`DEFAULT_LOCALE`, `LOCALE_INDEPENDENT_DIRS`,
  `localeAssetPath`, `rewriteFragmentRefs`); `server/effects/pages.ts` (per-locale loop,
  `pageDepth`, `hreflangAlternates`, `rootRedirectPage`); `server/effects/md-mirror.ts`
  (per-locale mirrors); `server/effects/simulate.ts` (locale loop, `declaresI18n` wiring,
  `locales` in the result); `server/tsrx/sim/realm.ts` (conditional locale in the cache key);
  `server/effects/i18n.ts` (`BUILD_I18N.pageLocale` from config, new `I18N_LOCALES`);
  `server/templates/sitemap.ts` (per-locale `<loc>` + reciprocal `xhtml:link` alternates);
  `server/serve.ts` (locale-prefixed routes, `/` → 302, `/index.html`, extensionless
  redirect); `docs-src/layouts/*.html` (`{{ lang }}`, `{{ hreflang-alternates }}`); tests
  (`serve.test.ts`, `templates/sitemap.test.ts`, `effects/simulate.test.ts`).
  **How:** `LOCALES = ['en', 'de']`; the pages effect emits one complete page tree per locale
  into `docs/<locale>/`, with the locale fixed before rendering begins.
  **Two design calls worth the Architect's attention:**
  1. **Only PAGES multiply.** `docs/api/`, `docs/examples/` and `docs/sources/` hold
     lazy-loaded FRAGMENTS (verified: no `<!doctype>`, no layout) generated from TypeDoc and
     `examples/` — content no catalog can translate. They stay single-copy at the docs root;
     `rewriteFragmentRefs` retargets pages' `./api/…` references to `../api/…` at build time.
     The alternative (duplicating them per locale) writes byte-identical output. Done as a
     build transform rather than an authoring change because `docs-src/` is read-only to this
     skill and content should not have to know a locale prefix exists.
  2. **`base-path` split in two.** A locale prefix separates two things that used to
     coincide: `{{ base-path }}` now reaches the DOCS ROOT (`localeAssetPath(depth)` — assets,
     `llms.txt`, fragments), while `processedFile.basePath` stays LOCALE-RELATIVE and keeps
     driving page links unchanged. `file-signals.ts` needed no change as a result.
  **Two things the change had to add rather than move:**
  - `docs/index.html` is now a redirect stub (meta-refresh + canonical + no-JS link). Every
    page moved under a prefix, and a static host has no route hook — the dev server's 302
    does not exist on GitHub Pages.
  - Extensionless page URLs (`/en/examples`) now redirect on the MISSING EXTENSION. The old
    301 fired only where a same-named directory happened to sit beside the page; the locale
    split removed those directories for `api/` and `examples/`, so the affordance had to be
    made deliberate or it would have silently become a 404.
  **Perf obligation (the ADR's own ask), measured end to end, twice each:** **1 locale
  3723 ms, 2 locales 3746 ms — +23 ms.** Simulated stage flat: 4 occurrences / 4 renders /
  0 hits / 80 ms at one locale, 8 occurrences / **4 renders / 4 hits** / 76 ms at two. LT-175's
  containment (locale in the cache key only when `declaresI18n`) is doing exactly what it was
  measured to do. This does NOT meaningfully offset ADR 0029's Static-tier savings — the ADR's
  fear was calibrated on a pre-0029 corpus. See LT-175's correction note for why the earlier
  ≈3.9 s/locale projection was wrong.
  **Check:**
  - The two design calls above, especially #1 — if fragments SHOULD be per-locale, the
    `rewriteFragmentRefs` layer comes out and routing changes with it.
  - `rewriteFragmentRefs` is a regex over rendered HTML (`href|src|value="./<dir>/`). It is
    the same class of transform as `resolveInternalLinks`, but it is a regex over HTML.
  - **Deliberately NOT done:** the document-level page renderer and the page-position ambient
    `lang` walk (`<section lang="cy">` around arbitrary occurrences) that LT-191's scope ruling
    parks in LT-174. LT-174's own entry scopes it to path-prefix routing and per-locale SSG,
    and the walk needs a renderer that server-renders compose sites INTO pages — which the
    build still does not do (pages embed authored markup; examples html is copied verbatim).
    That is a separate task, not a detail of this one; **it needs its own ticket.**
  - ADR 0030's consequences bullet is now doubly stale (see LT-175) and wants amending.
  **Context:** Path-prefix routing (`/de/guide`, `/en/guide`), one SSG page per locale, locale
  fixed before rendering begins. **The build-time-constant property is load-bearing, not an
  infrastructure preference** — it is what lets `Intl` fold and keeps i18n components on the
  Folded tier; a request-time locale would unfold every `Intl` call and push the whole i18n
  corpus to Simulated. **Perf obligation:** re-measure when the second locale lands and record
  the figure — it partially offsets ADR 0029's Static-tier savings. LT-175 is that measurement
  and lands first.

- [x] LT-190: `<key>.<category>` message keys — plural word forms the catalog can actually translate (LT-173 review finding). — reviewed ✓ (public-surface change: catalog convention + validation)
  **Skill:** le-truc-dev
  **Review (architect, 2026-09-06):** Approved. The flat-key ruling implemented
  faithfully, and the subtle part is right: census reachability reads the PLATFORM
  per locale (never a table) with the case type's provenance on the registry, and
  the `'union'` fallback over-reports reachability — the conservative direction,
  since a translation that might render should exist. The quoted-key bug
  (`identifierName` silently dropped `'task.other'`) is exactly the kind of thing
  the validation rule now makes loud. End-to-end record resolution verified during
  review (`i18nRecord('basic-pluralize', 'de').t['task.other'] === 'Aufgaben'`; zh
  carries only `task.other` and falls back to source for the rest); its fixture is
  queued in **LT-192**.
  **Context:** LT-173's catalog keys each resolve to ONE string, so per-category word
  forms have no home: `basic-pluralize`'s template spells the plural as the catalog
  noun plus a literal `s` in the two/few/many/other spans — English morphology the
  catalog cannot override (a German compose-site render reads "Aufgabe + s", a
  Chinese one litters a Latin `s` into its only form, and no irregular English noun —
  person/people, foot/feet — can be expressed either). Pinned as the KNOWN GAP
  fixture in `gate-wave-verification.test.ts`; rewriting that pin is the completion
  signal. **Architect ruling (2026-09-06): flat keys with a `.<category>` suffix** —
  `task.one`, `task.other` — NOT camelCased keys. Dots carry the CLDR category names
  verbatim, stay greppable and JSON-friendly, and change nothing about the format: a
  suffixed key is just a longer flat key, so the `<tag>.<key>` namespacing, the
  generated module, and the staleness hashing all work unchanged.
  **How:**
  1. Authoring: the component declares per-category keys in its `export const i18n`
     (`'task.one': 'task'`, `'task.other': 'tasks'`) and references them by dynamic
     lookup through the EXISTING flat record — `t['task.' + category]`, conventionally
     inside the matching `truc:case` span (`<span truc:case="one">{t['task.one']}
     </span>`). No new runtime surface: `t` stays `Record<string, string>`. Base and
     suffixed keys coexist; the suffix is optional per key.
  2. Validation — **channel: compiler, Tier 1 (Prevented) per ADR 0028**: a declared
     key whose dot-suffix is not one of the six CLDR categories (`task.onee`) is a
     shape error (TSRX008-family or a new code — developer's call, one code; Tech
     Writer owns the copy per `workflows/error-message-lifecycle.md`).
  3. **Census awareness is the subtle part.** A suffixed key whose category is not in
     the locale's platform set is UNREACHABLE there — the span is pruned — so the
     translation census must not report it missing or stale. The census needs the
     component's configured case type (`cardinal`/`ordinal`/`union`) on the
     RegistryEntry, derived from the `truc:case-type` analysis the compiler already
     does, then skips suffixed keys outside `pluralCategories(locale, caseType)`.
     Without this, the first English catalog of a six-category component reports five
     phantom gaps. Census keys become `<tag>.<key>.<category>` leaves; staleness
     detection is unchanged (per flat leaf — verify by editing a source string).
  4. **No implicit fallback chain** (the ruling's corollary): a reference resolves
     the exact suffixed key or nothing — no category→`other`→bare chain. The source
     locale declares every key its template references, so the source set is complete
     by construction; a locale missing `task.one` renders the source string and shows
     in the census like any other missing key.
  5. Migrate `basic-pluralize` to per-category keys and rewrite the KNOWN GAP pin to
     the correct forms ("Aufgaben" from the de catalog's `task.other`; no Latin `s`
     on the zh page). The committed catalogs (de/cy/zh/ar/pl/lv) gain the suffixed
     entries; `bun run i18n:sync` records their manifest hashes.
  6. **Scope note for the docs (Tech Writer):** per-category keys fix MORPHOLOGY, not
     word ORDER — "剩余 3 个任务" cannot be assembled from the count-noun-remaining
     template order. The stage-2 endgame is whole-phrase keys per category with a
     `{count}` placeholder (the ICU MessageFormat/Fluent shape). Record this as the
     documented next step; do not build it here.
  Acceptance: a German compose-site render reads "3 Aufgaben verbleibend" with the
  plural noun form coming from the de catalog's `task.other`; a zh render contains
  no Latin letters; an en render is unchanged apart from the migrated keys; the
  census does NOT count a category-suffixed key as a gap for a locale that prunes
  that category (fixture) and still counts genuinely missing ones; a moved
  `task.other` source string reports stale; compile-warning baseline stays 0;
  `bun test server` green; `bun run check:types` clean.
  **Implemented, per the ruling.** (1) `readI18nDecl` (server/tsrx/i18n.ts) accepts
  QUOTED keys — `identifierName` silently dropped `'task.other'` (string-literal
  keys are Literals, not Identifiers) — and validates that every dotted key's
  suffix is one of the six CLDR categories (TSRX008 shape error; the census treats
  the suffix as reachability input, so a typo'd suffix would corrupt that too).
  (2) `ComponentIR.caseType`/`RegistryEntry.caseType` (`'cardinal'|'ordinal'|'union'`,
  ir.ts/compiler.ts/registry.ts/index.ts): every `truc:case-type` expr statically
  provable and unanimous proves the type; an explicit `undefined` is cardinal;
  basic-pluralize's dynamic ternary stays `'union'` — the runtime's own fallback.
  (3) `collectI18n` (server/effects/i18n.ts) computes the locale's platform set for
  the entry's case type and skips suffixed keys outside it — a pruned span's key is
  unreachable, not a gap. (4) `basic-pluralize` migrated: six `task.<category>`
  source keys (en declares zero/two/few/many too — its ORDINAL set uses two/few,
  and the source set must cover every referenced key's fallback), spans reference
  `{t['task.one']}` … directly, the bare `{t.task}` noun is gone. (5) The six
  committed catalogs rewritten to their own reachable sets (de 4 keys, zh 3, cy/ar
  8, pl 6, lv 5), manifest regenerated via `i18n:sync` — census 0 gaps.
  **Changed:** `server/tsrx/` (`i18n.ts` quoted keys + validation, `ir.ts`,
  `compiler.ts` caseType walk, `registry.ts`, `index.ts`); `server/effects/i18n.ts`;
  `examples/basic/pluralize/basic-pluralize.tsrx`; `i18n/*.json` + `manifest.json`;
  tests (`i18n.test.ts` validation + reachability + gap-free-corpus fixtures,
  `gate-wave-verification.test.ts` KNOWN GAP pin rewritten to correct forms);
  `i18n/README.md`, `TSRX-HOST-PROFILE.md`, `CHANGELOG.md`.
  **Verification:** `bun test server` 1514 pass / 0 fail; `check:tsrx` clean
  (baseline 0, tier census 20 folded / 2 simulated unchanged, translation census
  0 gaps across 6 locales); `check:types` clean; biome clean. Snapshots re-pinned
  (span contents now carry the catalog's per-category words; connect diff verified
  to be exactly the count-fill boundary).
  **Handoffs:** Tech Writer owns the TSRX008 dotted-key message copy (first draft
  in `server/tsrx/i18n.ts`; propagation per `workflows/error-message-lifecycle.md`)
  and the stage-2 endgame note (whole-phrase keys with `{count}` — morphology vs
  word order) is recorded in the host profile for docs capture.

- [x] LT-191: Restore ancestor `lang` inheritance for compiled components (LT-173 review follow-up; amends ADR 0030 s7's posture, not its mechanism). — reviewed ✓ (public-surface change: locale resolution + config-attribute rule)
  **Skill:** le-truc-dev
  **Review (architect, 2026-09-06):** Approved. The config-only ruling carried to
  its structural conclusion — expose on an IDL property was a silent no-op all
  along, and materializing the walked locale onto the attribute gives the SSR and
  client paths ONE DOM shape; the CI equivalence audit passing without re-pinning
  is the soundness property demonstrating itself. The config-attribute fold route
  is principled (HTML's own global locale config, not a hand table) and minimal
  (only pluralize matched; the tier map is byte-for-byte unchanged). Stage 2 as
  compose-graph inheritance is the right scope given that no document-level
  renderer exists; the page-position walk belongs to LT-174, which builds that
  renderer. Residue queued in **LT-192**.
  **Context:** LT-173 made `basic-pluralize` read its OWN `lang` attribute as a
  connect-time Parser prop, retiring the ancestor walk for compiled components — a
  pluralize under `<div lang="cy">` (or `<html lang="de">`) with no own attribute now
  resolves `'en'`. That contradicts the platform (CSS `:lang()`, font selection, and
  screen readers all inherit language) AND the corpus's own contracts: `basic-number`
  still documents "falls back to the nearest ancestor's `lang`" and still calls
  `getLocale(host)` live, so LT-173 left the corpus split-brained. **Architect ruling
  (2026-09-06): inheritance itself is NOT fundamentally blocked.** The ambient `lang`
  at a static page position is as build-time-constant as the page locale, so the
  fold, the `truc:case` pruning, and the root-attribute render all survive — and the
  one hard limit stays where ADR 0030 s6 put it: the catalog never ships, so the
  client can never RE-translate server-rendered words at a different locale. Stages:
  1. **Client, small:** seed the prop from the walk at connect —
     `expose({ lang: asString()(getLocale(host)) })` (`getLocale`'s
     `closest('[lang]')` includes the element itself, so own-attribute-first is
     preserved). Sound by construction: an SSR'd instance carries the build locale on
     its root attribute and terminates the walk immediately, so the walk can never
     disagree with the build there; the walk only answers for client-authored markup
     (demo pages, third-party pages). Revert the demo's Welsh instance to the
     ancestor-wrapper shape and add an own-attribute-beats-ancestor instance.
  2. **Server, the real fix:** ambient-lang tracking in the page/example renderers —
     walk the document being rendered, maintain the `lang` stack, feed the ambient
     locale into each occurrence's record. Precedence becomes: explicit
     compose-site/authored arg > ambient `lang` at the render position > authored
     default > build page locale (note the reorder: page-authored context outranks
     the component's fallback default). The effective locale still renders onto the
     root attribute — DOM-is-truth, already the rule.
  3. **NOT restored — the fundamental limit, document it:** per-evaluation re-walking.
     The LT-115 twin re-read `getLocale(host)` per thunk evaluation, so moving an
     element across lang subtrees at runtime re-selected its category spans; the
     connect-time seed freezes the walked locale for the connection, and for
     server-rendered words re-selection at a new locale is impossible in principle
     (frozen words, no catalog on the client — the mongrel state: new-language
     category selection over old-language text). Restoring the live walk would also
     need the compiler to splice a blessed walk idiom server-side (user-land
     `getLocale` is outside the fold vocabulary — exactly why pluralize's six thunks
     didn't fold pre-LT-173) without adding library i18n surface (ADR 0030 s8).
     Defer until a real case appears; state the boundary in the host profile.
  Acceptance: a compiled pluralize with NO own `lang` under `[lang="cy"]` selects
  Welsh categories at connect (fixture); an SSR'd instance's root attribute still
  wins over any ancestor; a compose site's explicit `lang` still overrides
  everything; pluralize stays Folded with unchanged pruning (stage 1 touches only
  the client seed); under stage 2, an occurrence beneath `<section lang="cy">` in a
  page renders the six-span cy set while an occurrence above it renders the page
  locale's set (fixture); `bun test server` green; ADR 0030 amended via adr-keeper
  (s3 precedence chain, s7 posture: the walk returns as the client-side route for
  client-authored markup, the record stays canonical for rendered pages); host
  profile and both components' JSDoc updated to match.
  **Implemented — with two rulings from execution.**
  **Ruling 1 (user, 2026-09-06): `lang` is a CONFIG attribute only, not a reactive
  property — it must not be exposed.** And it structurally cannot be: `lang` is a
  built-in IDL property, so `'lang' in this` is always true and `expose()`'s
  initializer is skipped silently (component.ts `#initSignals`) — the LT-173
  `lang: asString()` expose entry never actually ran; `host.lang` in the thunks
  reads the NATIVE accessor, i.e. the element's own attribute, live. The first
  draft's `asString()(getLocale(host))` seed therefore landed as the native
  accessor's `''`, and `Intl.PluralRules('')` threw per span — caught by the walk
  fixture before landing. The shape that works: **materialize** the walked locale
  onto the attribute at connect (`const materializeLocale = () => { if
  (!host.getAttribute('lang')) host.setAttribute('lang', getLocale(host)) };
  materializeLocale()` — the const+call is the sanctioned client-only setup shape;
  a bare `if` statement is not, TSRX005). Both paths now converge on one DOM
  shape: SSR renders the effective locale onto the root attribute, client-authored
  instances materialize the walked one. (2) The fold needed a new membership route:
  removing the parser exposure dropped `lang` from `foldableHostProps` and pluralize
  routed Simulated (tier canary caught it). Route 3 in `evaluability.ts`:
  **platform config attributes** (`lang`, `dir` — HTML's own global locale config,
  not a hand table) render onto the root and read back verbatim through the native
  accessor, so the root attribute's `exprText` is the server truth without a
  parser. Tier restored: pluralize Folded, census 20/2/0 unchanged.
  **Ruling 2 (scope): stage 2 landed as COMPOSE-GRAPH inheritance.** No
  document-level server renderer exists in the build today (examples html is
  copied verbatim; docs pages don't server-render compose sites), so
  position-level ambient tracking has nothing to ride on. `emit-server.ts`'s
  compose emission now resolves a child's record locale as: explicit site `lang`
  arg > the PARENT'S effective `lang` binding > authored default > page locale —
  the SSR analog of the ancestor walk, since the composition tree IS the rendered
  ancestor chain. The page-position walk (`<section lang="cy">` around arbitrary
  occurrences) is LT-174's, which builds the page renderer — its acceptance
  fixture belongs there.
  **Changed:** `server/tsrx/emit-server.ts` (compose inheritance), `server/tsrx/
  evaluability.ts` (PLATFORM_CONFIG_ATTRS fold route), `examples/basic/pluralize/
  basic-pluralize.tsrx` (materializeLocale; `lang` out of expose per the ruling),
  `examples/basic/pluralize/basic-pluralize.html` (ancestor-wrapper instance +
  own-attr-beats-ancestor pin), tests (`gate-wave-verification.test.ts`
  ancestor-only + own-attr realm fixtures, `i18n.test.ts` compose-inheritance
  fixture), `TSRX-HOST-PROFILE.md`, `CHANGELOG.md`.
  **Verification:** `bun test server` 1514 pass / 0 fail; `check:types` clean;
  biome clean; tier census unchanged (20 folded / 2 simulated); the CI equivalence
  audit passed WITHOUT re-pinning — an SSR'd instance's root attribute makes
  materializeLocale a no-op, which is the soundness property itself.
  **Also fold in (architect, 2026-09-07):** sub-design 1 gains the LT-174 output shape —
  pages multiply per locale under `docs/<locale>/`, but the lazy-loaded FRAGMENT trees
  (`api/`, `examples/`, `sources/`) stay single-copy at the docs root, because they are
  derived from TypeDoc and `examples/` and no catalog can translate them. **Architect
  confirmed 2026-09-07**, resolving the LT-174 NOTES entry. The consequences bullet on
  corpus multiplication was retracted in place on the same date.
  **Handoffs:** adr-keeper amends ADR 0030 (s3 precedence chain, s4 per-category
  convention + census reachability — folded in per LT-192, s7 posture: the
  walk returns as the client-side route for client-authored markup, the record
  stays canonical for rendered pages, `lang` config-only); Tech Writer reviews the
  host-profile `lang`/precedence rewording. `basic-number` keeps its live
  per-evaluation `getLocale(host)` walk (its spec contract) — untouched, and it
  never exposed `lang` either.

- [x] LT-192: LT-190/LT-191 review residue — compiler-doc staleness, the AGENTS IDL-skip surprise, and the catalog→record pin. — done ✓ (docs + test; internal-only)
  **Skill:** le-truc-dev (docs items route to Tech Writer)
  **Context:** The LT-190/LT-191 review approved both but found three small items
  too concrete to leave in handoff prose:
  1. `server/tsrx/LE_TRUC_COMPILER.md` is stale in three places: (a) the
     classification section still says a locale read from the DOM (`getLocale(el)`,
     `host.lang`) routes Simulated and that "`basic-pluralize` … stays
     Simulated-tier" — stale since LT-173 (Folded) and doubly stale since LT-191
     (root-rendered `lang`/`dir` now fold via the platform-config-attribute route
     in `foldableHostProps` route 3); (b) the i18n section's precedence chain stops
     at "site lang > authored default > page locale" — LT-191 inserted the parent's
     effective locale and made `lang` config-only; (c) the message-keys paragraph
     predates the `<key>.<category>` convention (dotted-key validation, census
     reachability, quoted-key extraction). Tech Writer owns the rewording; the
     review lines on LT-190/191 carry the facts.
  2. `AGENTS.md` "Surprising Behaviors" never documents that `expose()` on a
     built-in IDL property name (`lang`, `dir`, `title`, …) is SILENTLY SKIPPED by
     the `prop in this` guard — the attribute stays the only channel, and a prop
     you meant to react on just... doesn't. This cost a debugging cycle in LT-191
     (`asString()(getLocale(host))` landed as the native accessor's `''` and
     `Intl.PluralRules('')` threw per span). One bullet, platform's own rule.
  3. Pin the end-to-end catalog→record path in `server/tests/tsrx/i18n.test.ts`'s
     generated-module block: `i18nRecord('basic-pluralize', 'de').t['task.other']
     === 'Aufgaben'` and the zh source-fallback (`t['task.one'] === 'task'`) — the
     LT-190 acceptance verified this manually during review, but no fixture pins
     the OVERRIDES-embedded module resolution; the gate fixtures pass their `t`
     by hand and bypass the catalog.
  Also fold into the adr-keeper pass already queued on LT-191: ADR 0030 s4 gains
  the `<key>.<category>` convention and the census's reachability rule (the
  handoff previously named only s3/s7).
  Acceptance: the three doc spots name LT-190/191 and match the implemented
  behavior; the AGENTS bullet exists; the i18n.test.ts assertions land (and fail
  if someone drops the de.json override path); `bun test server` green.
  **Done.** (1) `LE_TRUC_COMPILER.md`: the classification paragraph rewritten —
  a locale read from the DOM folds only when the compiler can splice it
  (`host.lang` over a root-rendered platform config attribute = LT-191's route 3;
  an ancestor walk through a user-land helper still routes Simulated), and the
  "pluralize stays Simulated-tier" claim replaced with its actual Folded fact;
  the reserved-parameters paragraph carries the full LT-191 precedence chain and
  the config-attribute rule; the message-resolution paragraph carries the
  `<key>.<category>` convention (quoted keys, suffix validation, source-declares-
  every-referenced-key, census reachability with `RegistryEntry.caseType`); the
  module-map row updated. (2) `AGENTS.md` "Surprising Behaviors" gains the IDL
  bullet: expose() on a built-in IDL property (`lang`, `dir`, `title`, …) is
  silently skipped by `prop in this` — the attribute is the only channel; seed
  it, don't expose it (the parser-applied-seed shape does not help either). (3)
  `i18n.test.ts` pins the catalog→record path: `i18nRecord('basic-pluralize',
  'de')` resolves `task.one`/`task.other` from the committed de.json through the
  generated module's OVERRIDES, and zh resolves `task.other` from its catalog
  with `task.one` falling back to the source string. Tech Writer review of the
  reworded paragraphs folds into the open copy handoffs (TSRX008 message, ADR
  0030 amendment).

- [ ] LT-193: Remove LT-166's render cache and LT-175's locale containment with it.
  **Skill:** docs-server-dev
  **Context:** **Architect ruling (2026-09-07): remove it.** LT-175 measured the cache at
  **0 hits on a one-locale build** — pure overhead — and 4 hits at two locales only because
  no Simulated-tier component declares `i18n`. **LT-195 ends that**: `form-combobox` and
  `form-listbox` are the corpus's ONLY two Simulated-tier components and BOTH carry
  translatable strings, so the moment they declare `i18n` the locale rejoins their key and the
  hit rate returns to zero. The containment contains nothing.
  **Why the premise cannot come back** (the argument that would have saved it, tested and
  refuted): the cache was justified by a 93.5% hit rate over 3,330 occurrences, which assumed
  the whole corpus flows through the realm. ADR 0029 ended that permanently, not temporarily —
  counted on the built docs, **3,249 occurrences, of which `module-scrollarea` alone is 1,966
  (60%)**, and ADR 0029 routed it off simulation because the realm *cannot* answer it. Even if
  LT-194's page renderer routed every page occurrence through the realm, the Simulated-tier
  share is **9 occurrences** (`form-combobox` 2 + `form-listbox` 7). There is no future
  corpus-scale hit rate to preserve.
  **How:**
  1. Delete `renderCache`, `renderStats` and the conditional-locale key from
     `server/tsrx/sim/realm.ts`, plus the `declaresI18n` constructor option LT-175 added.
  2. Drop `renders`/`cacheHits` from `SimulationPassResult` and the build log line
     (`server/effects/simulate.ts`); keep `occurrences` and `locales`.
  3. **Keep the two-order hermeticity test** (`sim-driver.test.ts`) — it tests corpus
     order-independence, which stands on its own. Remove only its cache-correctness clause and
     the comment explaining it.
  4. Rewrite the module header's "Render memoization" section out of `realm.ts`, and the
     cache-engagement expectations in `effects/simulate.test.ts`. Repeat renders of one
     component staying byte-stable is still an invariant worth pinning — keep that assertion,
     drop the hit/miss accounting around it.
  **Verification:** the cost this removes is ~4 renders (~4 ms on a 3,750 ms build), so the
  acceptance is NOT a speed figure — it is that the build's occurrence count, diagnostics and
  gate are unchanged, and the compile-warning and census baselines hold. Record the
  simulated-stage wall time before and after so the no-regression claim is a measurement.
  **Note for the record:** only quiescent, non-degraded renders ever memoized (`if (degraded)
  return parsed`), so the cache could not suppress a *degraded* or *non-quiescent* diagnostic.
  It could dedupe a `console`/`network` diagnostic on an otherwise-clean repeated render;
  after removal such an entry fires once per occurrence instead of once. The gate counts
  unclassified entries, so this changes noise, not verdicts — but say so in the handoff if the
  build report's shape visibly changes.

- [ ] LT-194: The document-level page renderer and the page-position ambient `lang` walk. **Depends on LT-174.**
  **Skill:** docs-server-dev
  **Context:** Resolves the second NOTES.md entry from LT-174. LT-191's scope ruling parked
  the page-position walk in LT-174; LT-174's own entry scoped it to path-prefix routing, and
  the developer built the stated scope and flagged the gap. **The developer was right to
  split it** — the walk needs a renderer that does not exist, so it was never a detail of
  LT-174. It is this ticket.
  **The gap:** the docs build does not server-render compose sites INTO pages. Pages embed
  authored markup; `examples/**/<tag>.html` is copied verbatim. So `emit-server.ts`'s compose
  inheritance (LT-191 stage 2) resolves a child's locale down the COMPOSITION tree, but a
  component's ambient `lang` from its POSITION on the page (`<section lang="cy">` wrapping
  arbitrary occurrences) has nothing to ride on. **LT-191's acceptance fixture has no home
  until this lands** — that is the completion signal.
  **Scope this deliberately, and expect it to be large.** Before building, answer: does the
  renderer replace the verbatim copy of authored markup, or wrap it? What is the unit of
  render — the page, or each occurrence? How does it interact with LT-174's per-locale page
  trees (one renderer pass per locale, locale already fixed)? Write those answers into
  NOTES.md or back to the Architect BEFORE implementing; a wrong shape here is expensive.
  **Constraint that survives regardless:** the page locale and the ambient `lang` at a static
  page position are both build-time constants (LT-191's ruling), so the `Intl` fold, the
  `truc:case` pruning and the root-attribute render all still hold. Do not introduce anything
  that makes either a runtime variable.
  **Perf note:** LT-193's data applies — the Simulated-tier share of page occurrences is 9 of
  3,249. Do not reintroduce a render cache for this; measure first if you think you need one.

- [ ] LT-195: Internationalize the corpus's hard-coded accessibility strings (demand check, 2026-09-07). **Depends on LT-173; sequence after LT-193.**
  **Skill:** le-truc-dev
  **Context:** Surveyed the 22-component `.tsrx` corpus for user-visible English literals.
  **Demand is real but small and sharply bounded** — 7 strings across 6 components, all of
  them static template attributes or visually-hidden text, all server-rendered, all
  translatable by ADR 0030's existing mechanism with no new surface:

  | Component | Tier | String | Site |
  |---|---|---|---|
  | `form-combobox` | simulated | `Clear input` | `aria-label` |
  | `form-listbox` | simulated | `Filter` / `Clear filter` | `placeholder` / `aria-label` |
  | `form-textbox` | folded | `Clear input` | `aria-label` |
  | `form-spinbutton` | folded | `Decrement` / `Increment` | `aria-label` (the second inside a thunk, with the literal as fallback) |
  | `form-tokenbox` | folded | `Remove` | `aria-label` |
  | `form-colorgraph` | folded | `Drag` | `.visually-hidden` span |

  **Two things NOT in scope, deliberately:**
  - **Developer-facing messages stay English.** `first('button', 'Add a native button as
    descendant.')` and friends address the page author in their console, not the end user.
    Translating them would be a category error — say so in a comment where it is tempting.
  - **Author-supplied content stays untouched.** `basic-gauge`'s qualification labels come
    from its `thresholds` attribute — page-author data, not component-owned strings. The
    component catalog is not the right home for them.
  **Watch for:** `form-spinbutton`'s increment label is a THUNK with `'Increment'` as its
  fallback (`zeroSpan.textContent ?? 'Increment'`). `t` is a build-time record, so
  `t['increment']` inside the thunk is fine — but confirm the fold survives it and the tier
  does not move.
  **Expected tier consequence, and the reason this is sequenced after LT-193:** two of the six
  are the corpus's only Simulated-tier components. Once they declare `i18n`, LT-175's
  containment stops applying to them — which is exactly why LT-193 removes it first rather
  than leaving a cache that silently stops engaging.
  **Verification:** tier census unchanged (20 folded / 2 simulated); compile-warning baseline
  stays 0; `bun run i18n:sync` records the new keys' manifest hashes; the de catalog gains real
  translations (not source echoes) for at least one component, pinned as a fixture.

- [ ] LT-196: Report orphaned catalog keys in the translation census (ADR 0030 s5 gap).
  **Skill:** docs-server-dev
  **Context:** **Demonstrated by falsification, not inspection** (architect, 2026-09-07):
  adding `"basic-deleted-component.gone"` and `"basic-pluralize.typo-key"` to `i18n/de.json`
  and running the build reports **`🌐 Translation census: 0 gap(s) across 6 locale(s)`**. The
  census walks DECLARED keys and checks catalogs; nothing ever walks catalog keys and checks
  declarations. `TranslationGap.status` is `'missing' | 'stale'` with no third case.
  **Why it matters more than it looks:** this is the exact failure mode a translator produces.
  Mistype `task.other` as `task.oher` and the census says all clear while the source string
  renders forever — the silent-wrong-answer shape, in the one place the project built a census
  specifically to make loud. It is also how a renamed key or a deleted component leaves
  residue in six catalogs with nothing to catch it.
  **How:** add `'orphaned'` to `TranslationGap['status']` — a catalog key with no declaring
  component, or whose component declares no such key. Include the per-category reachability
  logic LT-190 added, inverted with care: a suffixed key OUTSIDE the locale's platform
  category set is unreachable-but-legitimate, **not** orphaned. Getting that backwards would
  report every `task.one` in a locale without a `one` category.
  **Channel and tier (ADR 0028 s1):** the **build report / translation census**, tier **not
  applicable — a report, not an error**, and it does **not** fail the build. Same channel and
  posture as `missing`/`stale`, and for the same reason: a catalog is DATA, not component
  source, so the compiler has no jurisdiction over it, and a hard failure would break the
  legitimate rename-then-sync workflow. Tech Writer owns the census wording.
  **Also:** `scripts/i18n-sync.ts` should prune orphans (or list them for removal) in the same
  pass it writes missing keys — the census names the problem, `i18n:sync` is where a person
  fixes it.

- [ ] LT-197: Decide how client-side runtime strings get translated (exploration). **Depends on LT-195.**
  **Skill:** architect (with le-truc-dev for feasibility)
  **Context:** LT-195's survey turned up a category ADR 0030's mechanism **structurally
  cannot serve**: strings built at event time in the browser.
  - `form-tokenbox`: `` `Added token: ${trimmed}` `` and `` `Removed token: ${removedValue}` ``
    written into a `role="status" aria-live="polite"` region.
  - `form-colorgraph`: `setCustomValidity('Color out of gamut')`, three sites.
  ADR 0030 sub-design 6 is explicit that **no message catalog and no locale runtime ship to
  the browser**. These strings are therefore untranslatable today, on any locale, and the
  tokenbox ones are announced to screen-reader users — the accessibility case is the strongest
  one in the corpus, and it is the one the current design cannot reach.
  **Do not assume the answer is "ship the catalog."** That would contradict ADR 0030's payload
  posture and ADR 0003. Weigh at least: (a) server-render the message variants into the DOM
  and have the client select among them (the `truc:case` pattern, generalized — no payload,
  but only works for a closed set); (b) a tiny per-component compiled-in string map in the
  generated client, scoped to that component's declared keys (small payload, ADR 0030's
  "no catalog" is about the CORPUS catalog — is a per-component map the same thing?); (c)
  accept the gap and document it as a known limit. **Measure the payload cost of (b) before
  arguing about it.** Outcome is an ADR 0030 amendment or a new ADR, then tickets.

- [ ] LT-198: LT-174 review residue — four deferred minors. **Depends on nothing; any time.**
  **Skill:** docs-server-dev
  **Context:** The LT-174 code review (2026-09-15) returned ready-after-fixes; the two
  regressions it caught — llms.txt linking root-level mirrors that had moved into the locale
  trees, and blog author avatars resolving into the non-existent `<locale>/assets/` — plus
  the missing sitemap `x-default` are fixed in the same commit as the review. Four minors
  were judged real but not worth holding the commit for:
  1. Blog-post markdown mirrors 404 on the dev server: `/:locale/blog/:slug` (serve.ts)
     strips only `.html` and force-appends `.html`, so `/en/blog/<slug>.md` looks for
     `<slug>.md.html`. The mirrors exist at `docs/<locale>/blog/<slug>.md`; static hosts
     serve them fine. Handle `.md` in the blog route.
  2. Legacy root URLs (`/guide.html`, `/blog/<slug>`, …) now 404 with no redirect map —
     only `/` got the stub treatment. Decide: a 301 map in serve.ts, or accept it for a
     young site and record the ruling.
  3. `server/SERVER.md` still documents the old routes and output layout (`GET /` → the
     index page, `GET /blog/:slug` → root-level blog, `<page>.html` at the docs root).
     Tech Writer owns it.
  4. The new pure helpers (`rewriteFragmentRefs`, `localeAssetPath`, `pageDepth`,
     `hreflangAlternates`, `rootRedirectPage`) have no direct unit tests — the most
     corner-case-prone surface of LT-174. Route-level tests partially compensate; the
     avatar fix added tests for the path math it touched.

---

## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

- [ ] LT-188: Load the composed-children closure before the simulation pass renders (LT-169 review finding). **Land before P5 adds composition across tiers.**
  **Skill:** docs-server-dev
  **Context:** `server/effects/simulate.ts` loads a client module for each Simulated-tier
  component and nothing else. Children-first replay needs every composed child's tag DEFINED in
  the realm before its ancestor upgrades — `RegistryEntry.composesTags` exists for exactly this,
  and its own JSDoc states the case: a child that a parent's client module never imports (pure
  server-splice composition, no `pass()`/`first()` binding) is never pulled in by the import
  graph. A Simulated-tier parent composing a **Folded**-tier child therefore renders that child
  un-upgraded, and the served markup is silently wrong with no assertion to catch it. Today's
  corpus hides the hole: the only composing Simulated parent is `form-combobox` →
  `form-listbox`, and both are Simulated. Wave 4 (P5) will break that coincidence.
  Fix: the LOAD set becomes the subjects plus the transitive `composesTags` closure over the
  registry, children-first and de-duplicated against `realm.definitions` (the load-once
  assertion). The RENDER set stays Simulated-tier only, so `assertSimulatedTier()` and the
  no-realm-work-for-another-tier invariant are untouched — defining a tag is not simulating a
  component, and the ADR 0029 saving is unaffected.
  Second gap, same file: captured host-console output reaches `realm.diagnostics` but is only
  PRINTED on the normal path, through `gateOnSimReport`/`formatSimReport`. If the pass throws
  earlier (a `load()` assertion, an importer error), those lines die with the realm — print what
  was captured before rethrowing.
  **Channel:** the build report, unchanged; no new diagnostic kind and no TSRX code moves.
  Acceptance: a fixture with a Simulated parent server-splicing a Folded child renders the child
  UPGRADED, and removing the closure fails that test (pin the negative — a fixture whose child
  happens to be Simulated proves nothing); the existing "no realm render for another tier" pin
  stays green; a pass that throws during load still prints its captured diagnostics;
  `bun test server` green.

- [ ] LT-186: A TSRX rule for an unkeyed element sibling of a `@for` in a reconcile container (LT-185's compiler half).
  **Skill:** le-truc-dev
  **Context:** LT-185 cost form-tokenbox its only text input: the `.tsrx` port dropped the
  `data-unreconciled` attribute, `reconcile()` removed the input as an unkeyed child of
  `data-container`, and nothing said so. LT-185 added the DEV_MODE warning for the runtime half.
  This is the compiler half, and the **user's direction (2026-09-06) is that TSRX is the better
  channel precisely because it is earlier** — the author learns at compile time instead of by
  opening a browser in dev mode. The shape is statically decidable for the `.tsrx` corpus: an
  element sibling of a `@for` inside the same `[data-container]`, carrying neither `data-key`
  nor `data-unreconciled`, will be removed at the first reconcile. Note the two channels are
  **complementary, not alternatives** — the compiler cannot see hand-authored HTML written by a
  library consumer, which is the case the runtime warning keeps covering. Do not retire the
  LT-185 warning when this lands.
  **Channel:** compiler (a new `TSRX0NN`), per ADR 0028 sub-design 1 — **confirmed at the
  LT-185 review**, and it is the user's direction: the compiler is earlier than a browser
  dev-mode warning. **Tier:** 1 (Prevented). **Error, not warning** — decided here so it is not
  re-litigated at implementation: the compile-warning baseline's target is zero (ADR 0029 s6,
  REQUIREMENTS M23), so a warning would either be fixed immediately or break the baseline, and
  the fix-it is one attribute. Check the false-positive shape FIRST — a container that
  legitimately self-cleans a dirty server render: if a corpus component needs that, come back
  before writing the rule rather than weakening it.
  **A deviation from ADR 0028's usual pairing, stated so it is not "fixed":** the ADR's Prevented
  tier says the runtime check "remains, behaving as Contained". Here the runtime half is LT-185's
  DEV_MODE advisory, not a Contained error — nothing fails at runtime, so do NOT convert it to a
  `console.error` or invent an error class to match the pattern.
  **Copy:** Tech Writer owns the final wording and reviews it against LT-185's runtime message so
  the two agree (the ADR 0028 lifecycle applies — this introduces a code).
  Acceptance: the form-tokenbox shape at its pre-LT-185 state produces the diagnostic; a sibling
  carrying `data-unreconciled` does not, and neither does `module-list.tsrx` (whose container
  holds only the `@for`) — pin both negatives, the vacuous assertion is the failure mode; the
  compile-warning baseline stays at 0 over the corpus; `bun test server` green.

- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Skill:** docs-server-dev
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03). Two tests in
  `server/tests/tsrx/gate-wave-verification.test.ts` pass today but don't verify the behavior
  their name/comment claims — a regression in the underlying compiler behavior would fail
  neither.
  1. **`'the reactive spelling plans a client binding the static spelling does not'`** (line
     ~220) only asserts `hostVariant.spans`/`bareVariant.spans` are truthy — true of any
     compiled component. Fix: assert on the actual compiled `clientCode`, e.g.
     `hostVariant.clientCode` contains a `watch(...host.count...bindText(` call and
     `bareVariant.clientCode` does not (confirmed by hand at review: the distinction is real and
     present today).
  2. **`'composed under form-combobox, initial render stays hermetic'`** (line ~263) only
     asserts the string `<form-listbox` appears in the composed output — trivially true.
     `form-combobox` composes its listbox with `filterable={false}`, so there is no clear button
     to check; the acceptance-relevant behavior is the other known composed-filter case from the
     LT-154 review (the combobox's selected-but-`hidden` inner option is authored `truc:pass`
     filter wiring). Assert the first option renders both `aria-selected="true"` AND `hidden=""`
     in the initial (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus
     snapshot for `form-combobox`.
  Acceptance: both tests fail if the underlying compiled/rendered behavior regresses;
  `bun test server/tests` stays green.

- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. About which binding helper the compiler emits, not
  about server-execution tiering. v2.6 added `bindAria()` (ADR 0026) and the compiler does not
  know about it: all 7 reactive ARIA bindings in the corpus lower to `bindAttribute` with a
  **compiler-synthesized `String()`** — `String(selected.get() === pid)` (module-tabgroup),
  `String(host.value === optValue)` (form-listbox), `String(parseOklch(host.value).h ?? 0)`
  (form-colorgraph) — precisely the hand-rolled coercion ADR 0026 §2 exists to remove.
  **Fix:** lower a reactive `aria-*` attribute on an element target to
  `watch(<thunk>, bindAria(el, '<idlName>'))`, dropping the synthetic `String()` and letting the
  helper apply ARIA's own coercion (boolean → `'true'`/`'false'`, number → decimal, `nil` →
  clear). **Two hard constraints.**
  1. The attribute→IDL mapping is a **lookup table, not a transform**: ARIA attribute names
     carry no inner hyphens, so `aria-valuenow` gives no clue where the camel hump falls
     (`ariaValueNow`). Build the table by enumerating `ARIAMixin`'s names and applying the
     library's own forward rule (`ariaAttributeName`, `src/bindings.ts:512`) — do not
     hand-maintain a second list that can drift from the platform.
  2. `ARIAMixin` splits into **44 string-valued props and 8 element-reference props**
     (`ariaActiveDescendantElement`, `ariaControlsElements`, `ariaDescribedByElements`,
     `ariaDetailsElements`, `ariaErrorMessageElements`, `ariaFlowToElements`,
     `ariaLabelledByElements`, `ariaOwnsElements`) that take `Element`/`Element[]`. An IDREF
     *string* must NEVER be routed to one — `aria-describedby="x"` is not
     `ariaDescribedByElements`. Map string-valued props only; leave the IDREF attributes on
     `bindAttribute`. All of the corpus's IDREF ARIA is server-static today, so nothing
     regresses.
  Acceptance: the 7 sites lower to `bindAria` with no `String()`; the golden clients update; all
  842 Playwright example specs stay green (they assert on the ARIA *attributes*, which native
  reflection still mirrors for element targets); the post-ADR-0029 zero-warning gate holds (use
  the gate, not a hand-maintained expected count).

- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes. **Depends on LT-147's mapping table.**
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. Per ADR 0026 §1, host semantics belong on
  `internals.aria*`: invisible in markup, unclobberable by framework attribute rewriting, and
  still overridable by the consumer's own attribute. **Fix:** a reactive `aria-*` on the ROOT
  element lowers to `watch(<thunk>, bindAria(internals, '<idlName>'))` rather than to an
  attribute write on the host. **The two halves must land in the same commit,** because the
  routing is what makes the diagnostic necessary: `bindAria()` on an `ElementInternals` target
  **removes the shadowing content attribute** at its first value assertion (ADR 0026 §1,
  stale-attribute rule), so a server-rendered `aria-expanded="false"` on the host is deleted at
  hydration — by design, and fatal to any CSS selecting on it. **So:** diagnose a selector in
  the component's own `<style>` block that matches the HOST on an `aria-*` content attribute
  (e.g. `module-tabgroup[aria-expanded="true"]`), with the fix-it naming `:state()` (ADR 0016
  §8) as the component-owned styling hook. **The distinction is load-bearing and the diagnostic
  is wrong without it:** ARIA on CHILD elements stays on the attribute channel (native IDL
  reflection mirrors element-target writes), so the corpus's three existing
  `&[aria-selected="true"]` selectors — nested under tab buttons and option buttons in
  `module-tabgroup` and `form-listbox` — are CORRECT and must NOT warn. Only host-matching
  selectors do. **Zero corpus sites exercise either half today**, so write both fixtures first;
  this is a forward-looking guard in the LT-125/129 posture.
  **Carried from LT-177.** (1) This task owns the serialization pin LT-177 deferred: a corpus
  fixture whose root `aria-*` binding serializes WITH the attribute under simulation — LT-177's
  realm-level test pins the mechanism only, and a `.tsrx` fixture was meaningless before any
  root ARIA binding existed. (2) Under simulation `internals` is now non-null for
  non-form-associated components, so an imperative `internals.states.add(…)` in a factory throws
  a `TypeError`; route custom states through `bindState()`, which capability-probes and no-ops
  on skeletal internals.
  Acceptance: a root `aria-*` thunk lowers to the internals form; a host `[aria-*]` style
  selector warns; the three child selectors stay silent; the simulation serialization pin holds;
  the zero-warning gate holds.

---

## P4 — v3.0 deprecated-surface removal (separate branch; gates wave 4)

**Owner sequencing, 2026-09-04:** both removals run on a **separate branch**, and land **before
any wave-4 migration** (LT-095–LT-111) so migrated twins and newly generated clients never
target the removed forms. ROADMAP § "Dead ends: deprecated in 2.x, removed in 3.0" already
declares both; these tasks implement it. The Cause & Effect 2.0 re-export surface rewrite is a
separate track, blocked on CE 2.0 shipping — out of scope here.

- [ ] LT-178: Remove the `pass()` unrestricted-write short forms (ADR 0012 removal).
  **Skill:** le-truc-dev
  **Context:** ADR 0012 scheduled removal for the next major; the major is in pre-release
  (3.0.0-next.1) and the DEV_MODE warning still fires in `swapSlots`
  (`src/helpers/reactive.ts`). Delete the property-key and bare-writable-signal input forms from
  `PassedProps` handling and `toSignal` resolution — the thunk (read-only) and `{ get, set }`
  descriptor (mediated) forms remain the only inputs. ADR 0012's status records the examples as
  already migrated; sweep `examples/`, `test/`, and `docs-src/` for stragglers anyway.
  **Retires a DEV_MODE deprecation warning — Tech Writer reviews the copy removal** (warning
  message, JSDoc on `pass()`/`PassedProps`, CHANGELOG breaking entry, ROADMAP dead-end
  check-off). Channel note: this retires a check and adds none.
  Acceptance: the short forms are gone from the types and the runtime; nothing warns because
  nothing exists to warn about; `bun test` green; CHANGELOG carries the breaking entry.

- [ ] LT-179: Remove the explicit factory return contract and `forEachUnseen` (ADR 0018 v3.0 milestone).
  **Skill:** le-truc-dev
  **Context:** ADR 0018's v3.0 milestone, still pending at 3.0.0-next.1:
  `watch()`/`on()`/`pass()`/`each()`/`provideContexts()` return `void`;
  `FactoryResult`/`EffectDescriptor` leave the public return contract (`src/types.ts`,
  `index.ts`); the `forEachUnseen` return-reconciliation in `src/component.ts` is deleted, as is
  `each()`'s copy kept only for the v2.3→v3.0 window (ADR 0017). Hand-authored descriptor
  registration remains `watch(() => true, descriptor)` — the only documented path. Sweep
  examples/tests for `return [...]` factories. **Tech Writer reviews the doc touchpoints**
  (AGENTS.md, ARCHITECTURE.md § Effect Descriptors, CONTEXT.md Factory/Effect Descriptor
  entries, CHANGELOG breaking entry).
  Acceptance: helpers return `void`; `FactoryResult` is not exported; a bare-statement helper
  call cannot silently no-op (the collector is the only registration path); `bun test` green.

---

## P5 — Wave 4: example migrations

**Gated on LT-178/LT-179** (owner sequencing). Otherwise unblocked. The canonical pattern is
LT-092's: same-commit cutover — delete the `.ts` twin, point `examples/main.ts` at the generated
client, drop any CEM exclusion, keep the demo/spec green against the served compiled component.
Surface compiler gaps in NOTES.md — or fix them directly if small (LT-088 precedent) — never
weaken a component to dodge a gap. **Per migration, record the tier and the reason** alongside
the zero-warning check; only the Simulated tier opens a realm, so Folded and Static both mean
near-zero added build cost regardless of occurrence count.

**Two LT-165 obligations land on wave 4's first Static-tier component.** (a) `check:tsrx`
type-checks each module at its OWN classified tier and the Static census is empty, so the build
type-checks the Static emit path nowhere today; `emit-tier.test.ts`'s "dropped ⇒ name absent"
assertion stands in for it. The first real Static component closes the gap for free — confirm it
does. (b) Census reasons carry `origin: detail (line N)` but not the signal's `resolution`
(`realm` vs `none`), which is self-evident for today's Simulated reasons but not for a Static
one: a Static reason must also say why NOTHING answers it. Add the resolution to the reason text
then — the format is pinned and its tests update with it.

**Suppression records are incomplete by design** (LT-165 step 7). Reactive `truc:html`,
`class:`/`style:` maps (a shared-surface attribute, where a per-site revert would undo other
bindings' legitimate work) and `truc:pass`-into-child sites are NOT recorded, and a parent's
render does not consult a composed child's records. No corpus component hits these today. A
migration that produces a Simulated-tier component with an unresolvable read behind one of those
shapes must extend the record set FIRST — surface it in NOTES.md rather than shipping a site
that is suppressed in name only.

**`data-unreconciled` must survive its migration** (LT-185's root cause). Porting a component
to `.tsrx` silently dropped that attribute from form-tokenbox's input, and `reconcile()` then
removed the input as an unkeyed child — nowhere to type, no diagnostic. **`module-calctable`
(LT-109) and `module-todo` (LT-111) both carry `data-unreconciled` in their hand-written
sources today.** When migrating either, diff the emitted markup's attributes against the `.ts`
twin's before calling the port done, and assert the opt-out survives hydration the way
`equivalence-audit.test.ts`'s LT-185 regression test does for form-tokenbox. **LT-186 (P3) makes
this a compile error** — if it has landed by then, these two migrations get the check for free
and this note is redundant; if it has not, do the manual diff.

- [ ] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision). **Blocks LT-173's blogmeta fold verification.**
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
  Verify the component classifies Folded once migrated; LT-173 step 6 defers its fold
  verification here.

- [ ] LT-096: Migrate `module-codeblock` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). **Known pre-existing bug to fix during
  this migration** (LT-117 review): the twin calls `copyToClipboard(code, copy, {...}` bare — the
  `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label
  stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration —
  `watch(() => true, copyToClipboard(...))` — plus a spec assertion that click actually
  copies/toggles the label. **Perf:** this is one of the two components that move page chrome
  into the simulated corpus (299 occurrences in the built docs). Record the simulated build
  stage's wall time before and after, verify the render cache engages, and record the tier. Its
  `first('code')`/`first('button.overlay')`/`first('basic-button.copy')` refs predict Simulated,
  but ~299 occurrences make that ~0.33 s — not a blocker.

- [ ] LT-097: Migrate `module-cem-list` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Watch for: loop body reactive
  attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. culori usage follows the `asOklch.ts`/`_common`
  setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Has a spec — keep it green against
  `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Has a spec — keep it green against
  `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Has a spec. Watch
  for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related
  event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Watch for:
  `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for
  exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Has a spec. Watch for: the
  effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069
  acceptance case). **This component drove ADR 0029's three-tier shape and its tier is the thing
  to verify.** It reads `scrollLeft`/`scrollTop`/`scrollWidth`/`offsetWidth`/`scrollHeight`/
  `offsetHeight` and emits exclusively through `bindState(internals, …)`. **Expected tier:
  Folded** — the geometry reads live in scroll/observer callbacks and the
  `bindState(internals, …)` output never reaches served HTML (Static is equally acceptable; both
  are never simulated, so the ~2.3 s is unpaid either way). **Simulated is the outcome to
  investigate:** at 2,091 occurrences it reproduces the ~2.3 s ADR 0029 exists to avoid — either
  reshape the migrated component so its reads stay in client-only positions (per its
  demonstrated patterns) or surface the over-signal in NOTES.md. Record the actual tier, the
  reason, and the wall-time figures either way; only wrong served HTML is a correctness bug.

- [ ] LT-104: Migrate `module-lazyload` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working.

- [ ] LT-108: Migrate `module-carousel` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsrx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

---

## P6 — Cleanup round (after the corpus port)

- [ ] LT-093: Make TSRX004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires TSRX004's "never rendered"
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
  **Re-triaged 2026-09-06 (LT-165 step 5 landed).** The ADR 0029 concern stands and has
  sharpened: TSRX004 left the diagnostic channel, so a false firing on a fully
  phase-1-resolvable component now tiers it into simulation **silently** — it buys a realm and
  says nothing. It is not invisible, though: the tier census records the reason with its
  TSRX004 origin and line, so the failure mode is inspectable rather than lost. Stays in P6 on
  that basis. **Cheap check to run at the end of wave 4, before this task:** scan the census for
  any Simulated component whose ONLY reason is a TSRX004 origin — each one is a candidate false
  firing, and the list sizes this task's real payoff.

- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Skill:** le-truc-dev
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads
  it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the
  predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(),
  …)` — moves the read out of the statement and the signal draws TSRX004 again, so the author
  must repeat the predicate at every site (`form-combobox.tsrx` does, with a comment saying
  why). The diagnostic is loud, not silent, and the workaround is one line, so this is a DX wart
  rather than a correctness gap. **Fix:** resolve reads through `component.plainSetup` consts
  the statement names — the same one-hop widening `computeClientNeededNames` already does — or
  fold into LT-093, which is the same free-name-through-a-const wall from the other direction.
  The negative case is pinned in `server/tests/tsrx/client-setup-credit.test.ts`; flip that test
  when fixing.
  **Re-checked 2026-09-06 (LT-165 step 5 landed) — the premise above is now false.** "The
  diagnostic is loud, not silent" no longer holds: TSRX004 left the diagnostic channel, so
  hoisting a predicate into a plain setup const now routes the whole component to the Simulated
  tier with **no warning at all** — the author gets a jsdom realm instead of a one-line fix-it.
  That is a worse failure than the DX wart this was filed as, and it makes the
  `form-combobox.tsrx` comment ("repeat the predicate, here is why") unenforced guidance that
  the next author has no way to discover. The census reason still names the origin, so it is
  diagnosable after the fact. **Architect question at pickup:** this may warrant moving out of
  P6 — raise it rather than assuming the P6 placement still reflects its cost.

- [ ] LT-189: Document `ContextRequestEvent`'s cross-realm dispatch (LT-180 review finding).
  **Skill:** tech-writer
  **Context:** `requestContext()` now builds the `context-request` event from the HOST's own
  realm whenever the exported `ContextRequestEvent` class does not belong to it
  (`src/helpers/context.ts`, LT-180). The class stays exported and unchanged, and in the normal
  same-realm case it is still what gets dispatched — but in a cross-realm host (an iframe, the
  build's simulation realm) the dispatched object is a duck-typed `Event` carrying
  `context`/`callback`/`subscribe`, so a provider written as
  `if (e instanceof ContextRequestEvent)` would stop matching. This is protocol-conformant — the
  Web Components Community Protocol specifies the event's fields, not its class, and Le Truc's
  own `provideContexts()` reads the fields — so it is a documentation gap, not an ADR question
  (Architect ruling, 2026-09-06).
  Scope: the JSDoc on `ContextRequestEvent` and on `requestContext()`, plus the context section
  in `docs-src/pages/` and the `le-truc` skill's context reference. One rule to state: a
  provider checks `event.context`, never `instanceof`. No error copy moves.

- [ ] LT-187: `reconcile()` misreports a DUPLICATE `data-key` as "key not present in the source" (LT-185 review finding).
  **Skill:** le-truc-dev
  **Context:** Pre-existing, found reading the removal branch during the LT-185 review. In
  `classify()` (`src/helpers/reactive.ts`) a child is adopted only when
  `harvested !== null && keySet.has(harvested) && !current.has(harvested)`. A SECOND child
  carrying a `data-key` that is in the source but already claimed by an earlier sibling falls
  through all three conditions to the removal branch, where it draws the keyed message —
  "key not present in the source" — which is false. The key IS present; the child is a
  duplicate. An author chasing that message looks at their data source, where nothing is wrong,
  instead of at the two elements sharing a key in their markup. Removing the duplicate is the
  correct action, so only the message is wrong, not the behaviour.
  **Fix:** distinguish the two cases at the branch — `keySet.has(harvested)` separates "duplicate
  key, first occurrence wins" from "key not in source" — and give the duplicate its own message
  naming the collision.
  **Channel:** runtime DEV_MODE advisory (REQUIREMENTS S3), same as its sibling — NOT an ADR 0028
  tier, for the reason recorded in LT-185's review. Statically decidable for the `.tsrx` corpus
  in principle, but the compiler emits `data-key` on `@for` items itself and cannot produce a
  duplicate, so no `TSRX` rule is owed; hand-authored `reconcile()` markup is the only source.
  **Copy:** Tech Writer owns the wording; batch it with LT-185's and LT-186's messages so all
  three read as one family.
  Acceptance: a duplicate-key child draws the duplicate message, a genuinely absent key still
  draws the existing one, and both are pinned (the existing message has no test today — add one
  while there); `test:src` green.

- [ ] LT-134: TSRX035 and TSRX042 give opposite advice on the same construct (LT-131 review finding).
  **Skill:** le-truc-dev
  **Context:** TSRX035 (`duplicateIdAcrossArms`) tells the author "Give each arm's element a
  distinct id" — a static id per arm. TSRX042 then warns on each of those static ids. Both are
  individually true (TSRX035 is about two ids colliding within ONE instance, TSRX042 about one
  id colliding across TWO instances) and the server-arg fix satisfies both at once, but neither
  message says so, and an author fixing TSRX035 as instructed walks straight into TSRX042. No
  corpus component hits it today. **Fix:** make TSRX035's fix-it name the server-arg shape too —
  "give each arm's element a distinct id, taken as server args so they stay unique per instance
  (TSRX042)" — and check whether TSRX038 (`duplicateComposeId`) needs the same. Cheap,
  message-only; the point is that the diagnostic set should not contain a loop. **Tech Writer
  reviews the copy.**

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Skill:** le-truc-dev
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
  loop binding, or project the value through `expose()`) is not discoverable from it. **Fix:**
  detect the collision in the compiler — a `@for` collection name that also names a server arg,
  where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the
  shadowing and the rename. Low priority: no corpus component hits it, and the build already
  stops.

- [ ] LT-138: The `truc:html={}` sanitizer default is inverted between server and client (LT-128 verification finding). **Gated: deferred until a component actually authors `truc:html`; none does today.**
  **Skill:** le-truc-dev
  **Context:** The two halves of one `.tsrx` source disagree on the default trust posture:
  `server/tsrx/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
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
  (`configureHtmlSanitizer` is called only from `server/tests/tsrx/features.test.ts:25`).
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

---

## P7 — Backlog (not scheduled)

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2).
  **Skill:** le-truc-dev
  **Context:** Blocked on trigger: every example outside `test/*` and `docs/*` cut over to its
  compiled client — that is LT-111 plus the remaining dual-state components. CLI-first (LT-011,
  done) covers CI/agent workflows; this adds in-editor squiggles via a `@volar/language-core`
  plugin projecting the generated client module, reusing LT-011's span table.

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.
