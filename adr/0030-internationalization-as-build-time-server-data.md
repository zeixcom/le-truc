# ADR 0030: Internationalization as Build-Time Server Data

## Status

✅ Accepted

## Context

Nothing in this project has addressed i18n. REQUIREMENTS.md does not mention locale, translation, or `Intl`; §7 Out of Scope does not exclude it either. That was defensible while Le Truc was browser-only: **the client is the wrong layer to answer "what language is this page in."** A client-only component can do nothing better than what `examples/_common/getLocale.ts` does today — walk `closest('[lang]')` and fall back to `'en'` — because by the time the component runs, the answer is already in the DOM, put there by whoever rendered the page.

Once the compiler renders the page, that changes: the build **must** have an answer, and it must be the right one the first time. A multilingual docs site is now planned, which makes this concrete rather than anticipatory.

Three facts from the existing corpus shape the design:

1. **A working pattern already exists, by accident.** `basic-pluralize` and `basic-number` declare `lang` as a server arg, materialize it onto their root attribute, and read it back through `getLocale(host)`. That is ADR [0024](0024-adopt-tsrx-as-isomorphic-component-format.md) sub-design 3's "one site, three roles" applied to locale, and it works in every tier. It was not designed as an i18n mechanism; it fell out of the data account.

2. **There is a live silent-wrong-answer bug in the simulation realm.** `sim/realm.ts` renders with `document.body.innerHTML = markup`, so the simulated document's `<html>` carries no `lang`. `getLocale(el)` therefore sees only the component's *own* root attribute, never a page ancestor's. `basic-pluralize`/`basic-number` are safe only because they render `lang` themselves; `module-calctable` and `basic-blogmeta` call `getLocale(host)` with no `lang` arg and would resolve `'en'` under simulation regardless of the page's actual locale. This is exactly ADR [0027](0027-server-simulation.md)'s "the diagnostics loss is structural" hazard, with an instance.

3. **The client already picks among translations without a catalog.** `basic-pluralize` renders all six CLDR category spans and the client toggles `hidden`. No message catalog reaches the browser, no serialized payload — DOM-is-truth doing i18n's job.

## Decision

**Locale and translations are build-time server data.** They reach a component the way all other server data does — as a server arg — never through the context protocol, and never as a runtime catalog shipped to the client.

### 1. One SSG page per locale; locale is a build-time constant

Pages are rendered once per locale under a path prefix (`/de/guide`, `/en/guide`). Each page's locale is fixed before rendering begins.

This is load-bearing, not an infrastructure detail. Because the locale is a build constant, LT-142's `Intl` fold rule resolves it: `Intl.PluralRules(lang)` and friends become server-known and fold in phase 1. Under ADR [0029](0029-tiered-server-evaluation.md) that means i18n components are **Folded-tier eligible rather than the Simulated tier** — internationalization makes them cheaper, not more expensive. A request-time locale would make locale a runtime variable, unfold every `Intl` call, and push the whole i18n corpus to the Simulated tier; it also needs the per-request SSR path ADR 0029 sub-design 8 declined to commit to.

### 2. The reserved `i18n` parameter

A component that needs locale data declares a reserved parameter named `i18n`, and the compiler supplies it. **Callers never pass it** — this is the `children` precedent from ADR 0024 sub-design 10: a reserved parameter name that the compiler fills, so composition does not thread it by hand through the graph.

```
export function BasicPluralize(
  { count, i18n: { t, lang } }: { count: number; i18n: I18n },
)
```

It is an ordinary destructurable server arg, so authored sources stay honest TypeScript (ADR 0024 sub-design 16) and the value is server-known for folding. A component that does not declare `i18n` does not receive it and pays nothing.

The record carries:

| Field | Meaning |
| --- | --- |
| `lang` | BCP 47 tag for the page's locale |
| `t` | the component's own resolved messages (sub-design 4) |
| `timeZone`, `currency` | formatting configuration for `Intl` consumers — load-bearing, not decorative: see below |
| `dir` | text direction, derived from `lang` |

`timeZone` is what makes date formatting foldable. `basic-blogmeta` today constructs `new Date(year, month - 1, day)` in the build machine's local zone and formats with `new Intl.DateTimeFormat(locale, { dateStyle })` — no `timeZone` — so the build machine's zone is read twice and the value is not server-known. With `lang` and `timeZone` both supplied, the expression becomes deterministic and folds into the Folded tier. For a **date-only** value the robust form is `Date.UTC(y, m - 1, d)` formatted with `timeZone: 'UTC'`: it never shifts the day and reads no build-machine state at all. This also resolves the question ADR 0029 left open about local-timezone `Date` construction.

`dir` is exposed for components whose *logic* is direction-aware. It is not rendered per component — direction belongs on the page's `<html>`, and a component writing `dir` on its own root would fight the page.

### 3. An authored `lang` overrides the record

`basic-pluralize` and `basic-number` declare `lang` as a public attribute today (`@attribute {string} [lang]`), and those contracts stand. Precedence: **an authored `lang` server arg, or a `lang` supplied at a compose site, wins over the record's locale.** This is data-account bullet 2's sanctioned override shape — a host attribute overriding an inherited default — not a second copy of the same value.

The **effective** locale is what renders onto the component's root `lang` attribute. This needs no new `TSRX039` exemption: ADR 0024 sub-design 3 already excludes the root element's own attributes from the duplication rule, because the root *is* the host, so a value rendered there is the channel rather than a copy.

### 4. The component declares its message keys; the build resolves them

A component declares the keys it needs; the build supplies the locale's catalog and the compiler resolves `t` at render time. **A caller never passes translations.** The rejected alternative — a `t={{ … }}` object literal at the compose site — would require every parent to know its child's internal message keys, which is data-account bullet 3's ownership violation, and would duplicate the catalog at every call site.

**Keying is explicit.** Literal prose in a template stays literal; an author routes a string through `{t.key}` when it should be translated. The compiler warns on literal prose inside a component that otherwise uses the catalog, so a forgotten string is build-visible without full extraction machinery. That warning is **author-fixable and therefore a genuine warning** — it converges to zero, and the ADR 0029 sub-design 6 zero-target holds.

**Source strings live inline; translations live in per-locale files.** A component declares each key *with its source-locale string* in the `.tsrx` itself, so the component remains the single source of truth for the source locale and **no sibling file exists for it** — this matters, because a per-component catalog file would reintroduce exactly the three-file drift disease ADR 0024 was written to cure. Translations are purely additive override files, one per locale, component-namespaced:

```
i18n/de.json      { "basic-pluralize.remaining": "verbleibend", … }
i18n/fr.json      …
```

One file per language is also what translation work actually wants; N files per language is not.

**No catalog tiering.** There is no global/page/component override stack: a key resolves in exactly one place. Three layers that can each carry the same key would be the duplication smell `TSRX039` and data-account bullet 4 police everywhere else, and it would need precedence rules of the kind this project has repeatedly rejected. Page prose is not a catalog concern at all — a translated page is a per-locale page source (sub-design 1), not a catalog override. A shared namespace for genuinely cross-component terms is deliberately deferred until a real case appears.

**The catalog never reaches the client.** Messages are resolved into the rendered markup; nothing is serialized, consistent with ADR 0003.

### 5. A missing key falls back to the source locale and is reported as a translation census

A key absent from a locale's catalog renders the source-locale string, and the omission is recorded in the **build report as a translation census** — per locale, which keys are missing or stale.

It is deliberately **not** a compile warning. A missing translation is not fixable by the component author; it is the translator's work, and during an in-progress translation the count is expected to be non-zero for as long as the translation takes. Putting it in the warning channel would restart precisely the non-zero-baseline drift ADR 0029 sub-design 6 eliminated. The census is the same reporting pattern as ADR 0029's tier census, riding the same `sim/report.ts` channel, and it carries its own signal: a key count that grows without a translation landing is visible without pretending to be a compile warning.

**The build stays read-only.** It emits a gitignored report artifact — machine-readable per locale, plus a human summary — and the census count in the build summary. Writing missing keys back into the committed catalogs is a separate, explicit `i18n:sync` script, run by a person and diffable in review. A build that mutates tracked source files would be non-idempotent and would have CI writing to the working tree; scaffolding is tooling's job, not the build's.

This keeps mixed-language pages shippable mid-translation — the accepted cost of incremental translation, and the reason a build error was rejected.

### 6. The client gets the locale from the DOM, and varies by rendering alternatives

Two mechanisms, both already in the corpus:

- **The locale reaches the client through the rendered root `lang` attribute.** `getLocale()` reads it there. This is DOM-is-truth and it means the reserved parameter cannot be build-only: the client genuinely needs the locale at runtime, because `basic-pluralize` re-selects its CLDR category whenever `count` changes.
- **Runtime translation variance is rendered, not computed.** A component renders every alternative it might need and the client toggles among them — `basic-pluralize`'s category spans. This is why no message catalog has to ship.

**The toggles do not retire under a build-constant locale, and assuming they do would be a correctness regression.** Folding the locale fixes the *locale* input, not the other inputs: `basic-pluralize` exposes `count` as a reactive prop, so its CLDR category still changes at runtime, and the client cannot compute a translated plural form — Le Truc never client-renders (ADR 0024 sub-design 1). It can only select among strings the server rendered.

**What a build-constant locale does buy is pruning.** The compiler knows which categories the locale actually uses, so the rendered alternatives shrink to that set: `{one, other}` for English instead of all six, with the toggles intact over the smaller set. The category set is read from the platform — `Intl.PluralRules(lang, opts).resolvedOptions().pluralCategories` — not a hand-maintained table, for the same reason ADR 0024 sub-design 4 derives its ARIA mapping from `ARIAMixin`. One edge: cardinal and ordinal have different category sets, so pruning must use the set for the `type` actually configured, and fall back to the union of both when the compiler cannot prove which is in play.

### 7. `getLocale` survives; the realm gets seeded

The driver seeds the simulated document's `<html lang>` from the build's page locale, so `closest('[lang]')` resolves the same answer under simulation that it resolves in the browser. This fixes the Context's bug 2 and is worth doing independently of everything else here.

`getLocale()` is **not** retired. Its ancestor walk is the correct client-side behavior for pages Le Truc did not render, and the hand-written twins document it as their contract. But the reserved `i18n` parameter is the **canonical route** for compiled components, and the documentation says so: a component that depends on an ancestor walk depends on something the realm can only approximate, even seeded.

### 8. The library boundary is unchanged

`@zeix/le-truc` gains no i18n surface: no catalog, no message runtime, no locale resolution. Everything here is compiler and build tooling (ADR 0024 sub-design 7). The client-side i18n primitives are the platform's own `Intl`, plus the DOM the server rendered.

## Alternatives Considered

- **Locale via the context protocol** (`requestContext(LOCALE, 'en')`): rejected, and the reason is specific to i18n rather than general. ADR 0024 sub-design 15 renders a context's *fallback* server-side and lets the client correct once a provider resolves. For a number format that is the accepted flash; for translated prose it is a flash from English into German, and for a reader without JavaScript it is **the wrong language permanently**. The one channel whose server answer must be right the first time cannot be the channel designed around a fallback.
- **Caller-passed translation literals** (`t={{ remaining: '…' }}` at the compose site), the original sketch: rejected — every parent would have to know its child's internal message keys (data-account bullet 3), and the catalog would be duplicated at every call site.
- **Automatic extraction of all template literals**: rejected for now. It guarantees no string is forgotten, but it is substantial machinery (key stability across edits, disambiguating identical strings, a catalog edit for every text edit) and the untranslated-literal warning in sub-design 4 gets most of the benefit at a fraction of the cost. Revisit if the warning proves insufficient in practice.
- **A missing key as a build error**: rejected — it makes a partially translated locale unbuildable, so a new locale could never land incrementally. Attractive on the project's usual compile-time-contract grounds, and rejected only because translation is externally paced work.
- **A missing key as a compile warning**: rejected — it is not author-fixable, so it would sit in the warning channel indefinitely and reintroduce the non-zero baseline ADR 0029 sub-design 6 just removed.
- **Request-time content negotiation**: rejected — it needs the per-request SSR path ADR 0029 sub-design 8 declined, and it makes locale a runtime variable so no `Intl` call can fold, pushing every i18n component to the Simulated tier.
- **Tiered catalogs (global / page / component) with override precedence**: rejected — three channels able to carry the same key is the duplication smell policed everywhere else in this project, and the precedence rule it needs is the shape repeatedly rejected before. Page prose is a per-locale page source, not a catalog override, so the tier that motivated it was a category error.
- **Per-component catalog files co-located with the `.tsrx`**: rejected — it reintroduces a sibling file whose contract must be kept in sync by hand, which is precisely the three-file drift ADR 0024 exists to cure, and it hands translators N files per language instead of one. Inline source strings get the co-location benefit without the sibling file.
- **The build writing missing keys into committed catalogs** (i18next/Fluent "save missing" mode): rejected — self-maintaining and diffable, but it makes the build non-idempotent and has CI writing to tracked files. The same benefit is available from an explicit `i18n:sync` script a person runs.
- **Retiring `getLocale()` in favor of the server arg alone**: rejected — the ancestor walk is correct client-side behavior on pages Le Truc did not render, and it is the hand-written twins' documented contract. Seeding the realm addresses the divergence without deleting a working mechanism.
- **Discrete args (`lang`, `timeZone`, `currency`) instead of one record**: rejected — it multiplies the threading problem by the number of configuration axes, and the reserved-parameter mechanism makes the record free to pass.

## Consequences

**Good:**

- The server has a real answer to "what locale is this page," rather than the build machine's default or an ancestor walk over a truncated tree.
- Rendered markup shrinks as well: an English page carries two plural spans where it carries six today (sub-design 6).
- **i18n components get cheaper, not more expensive.** A server-known locale folds `Intl` (LT-142), so `basic-pluralize`'s six standing `TSRX034` warnings dissolve and it becomes Folded-tier eligible instead of the Simulated tier (ADR 0029).
- ADR 0029's unresolvability limb (b) stops firing for compiled components on the locale axis: there is no runtime-default locale to be unresolvable, because the record supplies one.
- No message catalog and no locale runtime ship to the browser. The client's i18n surface is `Intl` plus the DOM — no payload, consistent with ADR 0003.
- Composition does not thread locale by hand; the reserved-parameter mechanism keeps the compose graph free of plumbing, and a component that does not want i18n pays nothing.
- The realm seeding fixes a live silent-wrong-answer bug that exists today, independent of i18n.
- Both new reporting needs reuse the census pattern rather than inventing channels, and the compile-warning zero target survives.

**Bad / accepted tradeoffs:**

- **The corpus multiplies per locale.** ~3,700 component occurrences become N × 3,700, and LT-166's `(component, args)` memoization now keys on locale, so the measured 93.5% hit rate will drop — by how much depends on how many components actually consume `i18n`. This needs re-measuring when the second locale lands, and it partially offsets ADR 0029's Static-tier savings.
- Mixed-language pages are shippable and therefore will ship. That is the deliberate price of incremental translation, and the census is the only thing making it visible.
- The catalog pipeline (format, loading, key resolution, staleness detection, the report artifact, the `i18n:sync` script) is new build surface with no prior art in this repo.
- Source strings living inline means a source-locale copy edit is a `.tsrx` edit, which invalidates that key's translations. Staleness detection has to notice that, or translations silently drift from a source string that moved on.
- The untranslated-literal warning will fire broadly across the corpus during the i18n migration, before converging. Expect a period where the warning baseline is non-zero for a *known, closing* reason — unlike the routing signals, this one is genuinely author-fixable, so it must actually be driven to zero rather than reclassified.
- Pruning rendered alternatives to the locale's category set is now part of the decision (sub-design 6), which means the served markup for a component differs per locale beyond its text — a fact fixtures must pin per locale rather than once.
- Two locale channels coexist (the reserved record and an authored `lang` override), which needs the precedence rule documented wherever authors will meet it. The alternative — retiring the authored `lang` — would have broken two components' published attribute contracts.
- `dir` is exposed but deliberately not rendered per component, so RTL page setup remains the page author's job. A component that assumed otherwise would be wrong in a way nothing here catches.

## Related

- Requirements: [§4 Accessibility](../REQUIREMENTS.md#accessibility) (language and direction are accessibility-relevant), [§5 Technical Constraints](../REQUIREMENTS.md#5-technical-constraints), [§7 Out of Scope](../REQUIREMENTS.md#7-out-of-scope) (the library gains no i18n surface; this is compiler/build tooling)
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Host profile: [TSRX-HOST-PROFILE.md](../TSRX-HOST-PROFILE.md) (the reserved `i18n` parameter and the data account)
- Compiler: [`server/tsrx/LE_TRUC_COMPILER.md`](../server/tsrx/LE_TRUC_COMPILER.md)
- Related ADRs: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (s3 one-site-three-roles and the root-attribute exclusion; s10's `children` reserved-parameter precedent; s15 the context fallback this decision declines to use), [ADR 0027](0027-server-simulation.md) (the realm whose `<html lang>` sub-design 7 seeds), [ADR 0029](0029-tiered-server-evaluation.md) (why a build-constant locale means the Folded tier, and the census pattern both new reports reuse), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the client reads the locale from the rendered DOM)
