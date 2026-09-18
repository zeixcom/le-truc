# ADR 0030: Internationalization as Build-Time Server Data

## Status

✅ Accepted

## Context

Nothing in this project has addressed i18n. REQUIREMENTS.md does not mention locale, translation, or `Intl`; §7 Out of Scope does not exclude it either. That was defensible while Le Truc was browser-only: **the client is the wrong layer to answer "what language is this page in."** A client-only component can do nothing better than what `examples/_common/getLocale.ts` does today — walk `closest('[lang]')` and fall back to `'en'` — because by the time the component runs, the answer is already in the DOM, put there by whoever rendered the page.

Once the compiler renders the page, that changes: the build **must** have an answer, and it must be the right one the first time. A multilingual docs site is now planned, which makes this concrete rather than anticipatory.

Three facts from the existing corpus shape the design:

1. **A working pattern already exists, by accident.** `basic-pluralize` and `basic-number` declare `lang` as a server arg, materialize it onto their root attribute, and read it back through `getLocale(host)`. That is ADR [0024](0024-adopt-tsrx-as-isomorphic-component-format.md) sub-design 3's "one site, three roles" applied to locale, and it works in every tier. It was not designed as an i18n mechanism; it fell out of the data account.

2. **There is a live silent-wrong-answer bug in the simulation realm.** `sim/realm.ts` renders with `document.body.innerHTML = markup`, so the simulated document's `<html>` carries no `lang`. `getLocale(el)` therefore sees only the component's *own* root attribute, never a page ancestor's. `basic-pluralize`/`basic-number` are safe only because they render `lang` themselves; `module-calctable` and `basic-blogmeta` call `getLocale(host)` with no `lang` arg and would resolve `'en'` under simulation regardless of the page's actual locale. This is exactly ADR [0027](0027-server-simulation.md)'s "the diagnostics loss is structural" hazard, with an instance.

3. **The client can vary a translation without a catalog.** `basic-pluralize` proved it by rendering every CLDR category as a span and toggling `hidden` — no message catalog in the browser, no serialized payload, DOM-is-truth doing i18n's job. The mechanism does not survive this decision (sub-design 6), but the constraint it demonstrated does: whatever varies client-side must not pull a catalog across the wire.

## Decision

**Locale and translations are build-time server data.** They reach a component the way all other server data does — as a server arg — never through the context protocol, and never as a runtime catalog shipped to the client.

### 1. One SSG page per locale; locale is a build-time constant

Pages are rendered once per locale under a path prefix (`/de/guide`, `/en/guide`). Each page's locale is fixed before rendering begins.

The output shape keeps **pages** and **fragments** separate: complete pages multiply per locale under `docs/<locale>/`; the lazy-loaded fragment trees (`api/`, `examples/`, `sources/`) stay single-copy at the docs root. The fragments are derived from TypeDoc and `examples/` — content no catalog can translate — so a per-locale copy would write byte-identical output. Pages' fragment references are retargeted at build time rather than in content, and the docs root becomes a redirect stub, because a static host has no route hook for `/`.

This is load-bearing, not an infrastructure detail. Because the locale is a build constant, LT-142's `Intl` fold rule resolves it: `Intl.PluralRules(lang)` and friends become server-known and fold in phase 1. Under ADR [0029](0029-tiered-server-evaluation.md) that means i18n components are **Folded-tier eligible rather than the Simulated tier** — internationalization makes them cheaper, not more expensive. A request-time locale would make locale a runtime variable, unfold every `Intl` call, and push the whole i18n corpus to the Simulated tier; it also needs the per-request SSR path ADR 0029 sub-design 8 declined to commit to.

**Per-locale SSG pages are the docs-site convenience path, not the general model — the seam is stated here so it is not mistaken for a ceiling.** The general model is the render function plus `i18nRecord(tag, lang)` per call: locale is a *parameter of the render boundary*, and a host that renders per request at a per-user locale — REQUIREMENTS §1's PHP, Java, Python and C# CMS targets, which all do — calls the same function with a different `lang`. Message patterns make that cheaper than the alternative it replaces: selecting the locale's parsed patterns is a dictionary lookup, where the earlier shape would have re-folded per-category alternatives per request. What this ADR commits to building is the SSG path; what it commits to *not foreclosing* is the per-request one.

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
| `t` | the component's own resolved messages — a string per argument-less message, a function otherwise (sub-design 4) |
| `timeZone`, `currency` | formatting configuration for `Intl` consumers — load-bearing, not decorative: see below |
| `dir` | text direction, derived from `lang` |

`timeZone` is what makes date formatting foldable. `basic-blogmeta` today constructs `new Date(year, month - 1, day)` in the build machine's local zone and formats with `new Intl.DateTimeFormat(locale, { dateStyle })` — no `timeZone` — so the build machine's zone is read twice and the value is not server-known. With `lang` and `timeZone` both supplied, the expression becomes deterministic and folds into the Folded tier. For a **date-only** value the robust form is `Date.UTC(y, m - 1, d)` formatted with `timeZone: 'UTC'`: it never shifts the day and reads no build-machine state at all. This also resolves the question ADR 0029 left open about local-timezone `Date` construction.

`timeZone` and `currency` are the **defaults** for a component's `Intl` consumers; a message that needs a different formatting choice for one phrase states it inline in its own pattern (`{amount, number, ::currency/EUR}`). Two channels with a clear precedence — the record configures the component, the pattern configures the phrase — rather than the record being the only place a formatting choice can live.

`dir` is exposed for components whose *logic* is direction-aware. It is not rendered per component — direction belongs on the page's `<html>`, and a component writing `dir` on its own root would fight the page.

### 3. Locale precedence; `lang` is config-only

The record's locale is a default, and authored channels can override it. Full precedence, strongest first: **an explicit `lang` arg at a compose site or an authored `lang` server arg > the parent's effective locale (compose-graph inheritance) > the component's authored default > the page locale.** An explicit override is data-account bullet 2's sanctioned shape — a host attribute overriding an inherited default — not a second copy of the same value.

Compose-graph inheritance is the SSR analog of the ancestor walk: the composition tree *is* the rendered ancestor chain, so a compose site without its own `lang` resolves the parent's effective `lang` binding. A page-position ambient walk — `<section lang="cy">` wrapping arbitrary occurrences — is served by the **document-level page renderer** (LT-194, landed 2026-09-18): the build's page and example effects replace an occurrence with its server render when the component is Folded-tier and declares the reserved `i18n` parameter (whose server bytes the locale actually determines) and the occurrence's effective locale resolves at build time — own `lang` attribute, else nearest positional `[lang]` ancestor, else the page tree's locale. A baseless occurrence in the single-copy fragment trees (`examples/`) has no page-locale rung to fall back to and stays authored, so the walk's client-authored half is unchanged; a `lang`-arg component without `i18n` (basic-number) computes its locale-dependent value client-side, so it stays authored too — rendering it would only empty its authored text.

**`lang` is a config attribute, not a reactive property — and structurally cannot be one.** It is a built-in IDL property: `'lang' in this` is always true, so `expose()`'s guard skips the initializer silently and reads hit the native accessor, i.e. the live attribute. The attribute is therefore the only channel, and it is the right one — HTML's own global locale config. A compiled component materializes the walked locale onto its root attribute at connect (own attribute first, else the nearest ancestor `[lang]`, else `en`), so server-rendered instances, which already carry the effective locale there, and client-authored instances converge on one DOM shape — an SSR'd instance terminates the walk immediately, so it can never disagree with the build. The walked locale is then fixed for the connection: ancestor changes after connect do not re-walk, because the catalog never ships and the client can only select among alternatives the server rendered.

The **effective** locale is what renders onto the component's root `lang` attribute. This needs no new `TSRX039` exemption: ADR 0024 sub-design 3 already excludes the root element's own attributes from the duplication rule, because the root *is* the host, so a value rendered there is the channel rather than a copy.

### 4. The component declares its message keys; the build resolves them

A component declares the keys it needs; the build supplies the locale's catalog and the compiler resolves `t` at render time. **A caller never passes translations.** The rejected alternative — a `t={{ … }}` object literal at the compose site — would require every parent to know its child's internal message keys, which is data-account bullet 3's ownership violation, and would duplicate the catalog at every call site.

**Keying is explicit.** Literal prose in a template stays literal; an author routes a string through `{t.key}` when it should be translated. The compiler warns on literal prose inside a component that otherwise uses the catalog, so a forgotten string is build-visible without full extraction machinery. That warning is **author-fixable and therefore a genuine warning** — it converges to zero, and the ADR 0029 sub-design 6 zero-target holds.

**A message value is an ICU MessageFormat 1 pattern.** A key's value is a whole phrase in ICU MF1 syntax, and `t.<key>` resolves to a string when the pattern takes no arguments and to a function of its arguments when it does:

```
done:  'Well done, all done!'                                   → t.done
tasks: '{count, plural, one {# task} other {# tasks}} remaining' → t.tasks({ count })
```

This is the format's own standard — CLDR-backed, Unicode-governed, and the one every translation-management system already speaks. It is also not a new shape here: the `{placeholder}` pattern channel (sub-design 9) is the MF1 subset with the `plural` / `select` / `number` / `date` argument types unimplemented, so this decision finishes a format rather than replacing one. It buys interpolation, `select` (gender, formality), nesting, and inline number/date/currency formatting — everything a sentence containing a count, a name, a date or an amount needs, and none of which the earlier per-category key shape could express at all.

**Patterns are parsed at build time, never at runtime.** `@messageformat/parser` (build-time dependency) turns a pattern into an AST; number and date skeletons resolve to `Intl` options via `@messageformat/number-skeleton` / `@messageformat/date-skeleton`. **The AST evaluator is ours, and one evaluator serves both the server fold and the client** (sub-design 9) — so a server-rendered string and the client's recomputation of it cannot disagree. Reusing a third-party compiler for the server half would mean two independent implementations of the same semantics on the two sides of that equivalence. `@messageformat/core` is retained as a differential **test oracle**, not as a production dependency.

**`t.<key>(…)` folds like any other call.** A message whose arguments are server-known folds at render time into one string of markup; only a message with client-reactive arguments reaches the client, by the channel of sub-design 9.

**Argument checking is a build-time diagnostic, not a type.** The compiler validates a call site's arguments against the declared pattern's parsed argument set — a `TSRX` code, tier **Prevented** (statically decidable, author-fixable) — in the shared post-lowering pass, so it cannot drift between the two authored surfaces. `t`'s TypeScript type stays `string | ((args) => string)`; **authors must not rely on the wider member of that union**, because per-key precision (`tasks: (args: { count: number }) => string`) arrives later as compiler-generated `.d.ts`, which is additive to every artifact here but tightens the type. A computed `t[dynamicKey]` stays rejected: which keys a component references must be statically decidable.

There is **no implicit fallback chain** and no per-key category machinery: a reference resolves the exact key or nothing, and the source locale declares every key its template references, so the source-string fallback always has bytes. Plural morphology lives inside the pattern, where CLDR belongs, and the number of arms is the translator's business rather than a property of the key namespace. Dotted keys remain legal as plain namespacing; the rule that a dot-suffix must name a CLDR category is gone.

**Source strings live inline; translations live in per-locale files.** A component declares each key *with its source-locale string* in the `.tsrx` itself, so the component remains the single source of truth for the source locale and **no sibling file exists for it** — this matters, because a per-component catalog file would reintroduce exactly the three-file drift disease ADR 0024 was written to cure. Translations are purely additive override files, one per locale, component-namespaced:

```
i18n/de.json      { "basic-pluralize.tasks": "{count, plural, one {# Aufgabe} other {# Aufgaben}} verbleibend", … }
i18n/fr.json      …
```

One file per language is also what translation work actually wants; N files per language is not.

**No catalog tiering.** There is no global/page/component override stack: a key resolves in exactly one place. Three layers that can each carry the same key would be the duplication smell `TSRX039` and data-account bullet 4 police everywhere else, and it would need precedence rules of the kind this project has repeatedly rejected. Page prose is not a catalog concern at all — a translated page is a per-locale page source (sub-design 1), not a catalog override. A shared namespace for genuinely cross-component terms is deliberately deferred until a real case appears.

**The catalog never reaches the client.** Messages are resolved into the rendered markup; nothing is serialized, consistent with ADR 0003. The one bounded exception is the event-time string channel of sub-design 9, which serializes a component's own client-referenced keys as per-instance data — never the catalog.

### 5. A missing key falls back to the source locale and is reported as a translation census

A key absent from a locale's catalog renders the source-locale string, and the omission is recorded in the **build report as a translation census** — per locale, which keys are missing, stale, or **orphaned**. The census walks both directions between declarations and catalogs (LT-196): every declared key must be translated, and every catalog key must be declared — an entry nothing declares (a translator's typo, a renamed key, a deleted component) is reported as `orphaned`, because it can never render and would otherwise sit in the catalogs invisibly.

**Presence, and pattern integrity.** Every locale carries the same key set — plural arms live inside the value, so there is no such thing as a key that is unreachable in one locale and required in another, and the census needs no reachability rules in either direction. What the census gains instead are two data-quality walks over the pattern itself, both report-channel records for the same translator-paced reason as `missing`/`stale`/`orphaned`:

- **Argument preservation** — a translation whose argument set differs from the source pattern's can render broken text. `i18n:sync` flags it and cannot auto-fix it: an argument cannot be invented.
- **Arm coverage** — a translation whose `plural` arms do not cover the locale's CLDR categories will fall through. The categories come from the platform (`Intl.PluralRules(lang).resolvedOptions().pluralCategories`), not a hand-maintained table, for the same reason ADR 0024 sub-design 4 derives its ARIA mapping from `ARIAMixin`.

A translation that fails to parse renders the source pattern, which always parses, and is recorded like any other census entry — a corrupt entry is still the translator's work, and a typo in one catalog must not make a locale unbuildable.

**A format migration is a sanctioned manifest rebaseline.** Staleness is "the source string changed since this translation was made," so a mechanical rewrite that changes every source pattern without changing any meaning — MF1 to MessageFormat 2, when that migration is taken — must rewrite sources, translations and the hash manifest in **one commit** rather than marking every translation in every locale stale. This is the only sanctioned way to regenerate the manifest wholesale; any other mass-rebaseline is the drift the manifest exists to catch.

It is deliberately **not** a compile warning. A missing translation is not fixable by the component author; it is the translator's work, and during an in-progress translation the count is expected to be non-zero for as long as the translation takes. Putting it in the warning channel would restart precisely the non-zero-baseline drift ADR 0029 sub-design 6 eliminated. The census is the same reporting pattern as ADR 0029's tier census, riding the same `sim/report.ts` channel, and it carries its own signal: a key count that grows without a translation landing is visible without pretending to be a compile warning.

**The build stays read-only.** It emits a gitignored report artifact — machine-readable per locale, plus a human summary — and the census count in the build summary. Writing missing keys into — and pruning orphaned keys out of — the committed catalogs is a separate, explicit `i18n:sync` script, run by a person and diffable in review. A build that mutates tracked source files would be non-idempotent and would have CI writing to the working tree; scaffolding is tooling's job, not the build's.

This keeps mixed-language pages shippable mid-translation — the accepted cost of incremental translation, and the reason a build error was rejected.

### 6. The client gets the locale from the DOM, and recomputes the message rather than selecting among alternatives

**The locale reaches the client through the rendered root `lang` attribute.** `getLocale()` reads it there. This is DOM-is-truth, and it means the reserved parameter cannot be build-only: the client genuinely needs the locale at runtime, because a message with a client-reactive argument re-selects its CLDR category whenever that argument changes.

**A message with client-reactive arguments is recomputed, not selected.** The server renders the message for the initial argument values — so a reader without JavaScript sees the correct form, and sees it *without* a row of hidden siblings in the accessibility tree — and the client re-evaluates the pattern when an argument changes, by the channel of sub-design 9.

**This narrows ADR 0024 sub-design 1, and the narrowing is deliberate.** "Le Truc never client-renders" was about not shipping template and data twice and not re-rendering DOM subtrees on change. Substituting a text node from a pattern the server already parsed is neither: it is the same category of client-side work as the `Intl.NumberFormat` call `basic-number` already makes, and it produces a string, never structure. A message pattern is data, and evaluating it is not rendering.

**The per-category rendered-alternatives mechanism is retired.** `truc:case` and `truc:case-type`, the pruning of rendered alternatives to the locale's category set, and the `pluralCategories` plumbing are all removed: one element and one thunk replace six spans, six thunks, six keys and six translations per pluralized noun. An author who needs genuinely exotic variance the format does not cover still has first-class control flow — a ternary, or `@if`/`@switch` — on either surface. Keeping an unused variance vocabulary alive for a case the format covers would be drift waiting to happen.

### 7. `getLocale` survives; the realm gets seeded

The driver seeds the simulated document's `<html lang>` from the build's page locale, so `closest('[lang]')` resolves the same answer under simulation that it resolves in the browser. This fixes the Context's bug 2 and is worth doing independently of everything else here.

`getLocale()` is **not** retired. Its ancestor walk is the correct client-side behavior for pages Le Truc did not render, and the hand-written twins document it as their contract. But the reserved `i18n` parameter is the **canonical route** for compiled components, and the documentation says so: a component that depends on an ancestor walk depends on something the realm can only approximate, even seeded.

**The platform has no shortcut here, verified 2026-09-06.** `HTMLElement.lang` (and `.dir` the same) is plain reflection — `[Reflect]` in the HTML spec: it returns the element's own content attribute and `''` when that is absent. It never walks ancestors. The inherited, effective language MDN's `lang` global-attribute page describes under "Inheritance" is computed by the UA for `:lang()` matching, pronunciation, and font selection — a separate algorithm with no accessor exposed. Confirmed empirically in Chrome and in jsdom 30 (the sim's realm) alike: under `<html lang="en"><section lang="de"><p>`, `p.lang === ''` in both. A hand walk or a materialized attribute is therefore the only read channel, and it is why LT-191 materializes the walked locale onto the host's `lang` attribute at connect: the walk is the mechanism, and `host.lang` works only as the read channel that write enables.

### 8. The library boundary is unchanged

`@zeix/le-truc` gains no i18n surface: no catalog, no message runtime, no locale resolution. Everything here is compiler and build tooling (ADR 0024 sub-design 7). The client-side i18n primitives are the platform's own `Intl`, plus the DOM the server rendered.

The MessageFormat dependencies are **build-time only** and never reach emitted output: a pattern is parsed by the build, and what the client receives is a parsed AST plus a compiler-inlined evaluator (sub-design 9), not a library. No third-party byte ships.

### 9. Client-side messages ride a per-instance `i18n` attribute carrying parsed patterns

Two classes of translated string exist, and the channel follows one question: **are all of the message's arguments known to the build?**

- **Folded into the markup** — sub-design 4: `aria-label={t.clearInput}`, or `{t.greeting({ name })}` where `name` is server-known. One string of markup, catalog never shipped. This is the overwhelming majority.
- **Evaluated in the browser** — this sub-design. Either an argument is client-reactive (`t.tasks({ count: host.count })`, where the server renders the initial form and the client recomputes), or the message exists only at event time (a status announcement, a constraint-validation message), which no no-JS reader can miss because the interaction producing it already required JavaScript.

**What ships is a parsed AST, not a pattern and not a function.** A compiled message function is code and cannot ride a JSON attribute — carrying it would force per-locale client modules, which this decision rejects below. Carrying the raw pattern instead would need an ICU *parser* on the client, which is the expensive part. Neither is necessary: the build already knows the translated pattern, so the attribute carries the **AST the build parsed**, and the client preamble needs only a small evaluator over it — no parser, no `eval`, CSP-clean. `Intl.PluralRules(host.lang).select(n)` does category selection natively, and number/date formatting takes `Intl` options the build already resolved from any skeletons. The evaluator is emitted **narrowed to the constructs that component's patterns actually use**: an interpolation-only component gets a concatenation; nobody pays for `select` or dates unless they use them. It is the same evaluator the server fold runs, so the two sides cannot disagree.

For this class the compiler admits `t.<key>` reads in client positions — the positions the server-only name diagnostic rejects today: event handlers, reactive thunks, method bodies, expose thunks. The component's **client-referenced keys** — only those; keys used purely server-side are already bytes in the markup — serialize onto the component's root as a config-only **`i18n` attribute**, resolved per render call through the same `i18nRecord(tag, lang)` every render boundary already threads, so compose-graph inheritance and a per-occurrence locale apply unchanged. The root renders it exactly where the materialized `lang` renders, and the root-attribute exclusion applies for the same reason. The attribute is absent entirely when a component has no client-referenced keys: the payload is opt-in by demand.

The generated client preamble parses the attribute once at connect — a compiler-inlined, guarded `JSON.parse`, not a library export (sub-design 8 holds) — and merges it over the component's declared source-locale record, which the compiler emits **already parsed** for the same keys. The merged `t` is fixed for the connection, the same posture as the materialized `lang`. A client-created instance (no server render, no attribute) speaks the source locale: the documented limit, the same class as a page Le Truc did not render.

**The attribute is per-instance and locale-correct by construction.** Because it is built per render call from `i18nRecord(tag, lang)`, a de-rendered occurrence carries de patterns and an en-rendered one carries en patterns, so **one client bundle serves every locale** — the property that rules out baking messages into the generated client. Argument validation, the census's argument-preservation walk and the `TSRX` code that carries it are sub-design 4's and 5's, applying here unchanged.

**Boundary changes.** The `t` face of the server-only name diagnostic retires — a client-position `t.<key>` read compiles. `lang` stays server-only (the client reads `host.lang`, sub-design 3), and a computed `t[dynamicKey]` stays rejected: which keys to ship is statically decidable only for literal keys. The read-back-from-a-rendered-hidden-label interim taught for reactive thunks is superseded by this sub-design, not sanctioned alongside it — a thunk reads `t.increment` directly.

**The name is `i18n`.** It mirrors the reserved parameter — the attribute is that record's DOM-side face. The `truc:` prefix is not available for it: `truc:`-namespaced markup attributes are server-resolved directives, a different purpose.

## Alternatives Considered

- **Locale via the context protocol** (`requestContext(LOCALE, 'en')`): rejected, and the reason is specific to i18n rather than general. ADR 0024 sub-design 15 renders a context's *fallback* server-side and lets the client correct once a provider resolves. For a number format that is the accepted flash; for translated prose it is a flash from English into German, and for a reader without JavaScript it is **the wrong language permanently**. The one channel whose server answer must be right the first time cannot be the channel designed around a fallback.
- **Caller-passed translation literals** (`t={{ remaining: '…' }}` at the compose site), the original sketch: rejected — every parent would have to know its child's internal message keys (data-account bullet 3), and the catalog would be duplicated at every call site.
- **A static message taking no arguments, with plural word forms as per-category keys** (`'task.one'` / `'task.other'`, one rendered span per category), the shape this ADR carried until 2026-09-19: rejected. It cannot express interpolation at all — "Hello, {name}" has to be split into template fragments around a `<span>`, which works in English and breaks the moment word order differs — and it has no `select`, no nesting and no inline number/date/currency formatting. Plurals cost O(categories) *simultaneously* in DOM, markup, declared keys, translations and census machinery, per pluralized noun, so a sentence with two count-dependent nouns is a cross product of spans. It was flexible enough for standalone static prose and nothing else, and the ruling landed before a second component was authored against it.
- **MessageFormat 2.0** (`messageformat@4`, the Unicode successor and the basis of the TC39 `Intl.MessageFormat` proposal): rejected for now, and the path back to it kept open deliberately. MF2 is better in the abstract — declarative, an extensible function registry, a real bidi-isolation story — but translation-management tooling speaks MF1 natively and MF2 only partially, which forfeits the main reason to adopt a standard at all; MF2's bidi advantage is also weaker against an HTML target, where `<bdi>` and `dir="auto"` are the better channel. Decisively, **MF2 spells placeholders `{$token}` where MF1 spells them `{token}`**, so adopting it would break the already-ruled pattern channel on day one. The migration is mechanical and available from the same maintainers (`@messageformat/icu-messageformat-1` parses MF1 into the MF2 data model, which `messageformat@4` serializes), and `messageformat@4` is itself the `Intl.MessageFormat` polyfill, so adopting MF2 later never waits on browsers. The two costs to plan for are nested-to-flat arm expansion (translator re-review, scaling with corpus size) and escaping differences, which round-trip fixtures over the corpus pin.
- **Fluent** (`@fluent/bundle`): rejected. Genuinely nicer for translators — asymmetric localization, terms, grammatical-gender references — but it is a *runtime interpreter* rather than a compile-to-function format, so the client cost is a parser and a bundle instead of a parsed AST; tooling support is thin outside its own ecosystem; and its asymmetry is precisely what the bidirectional census would have to stop enforcing.
- **i18next-style suffix keys plus `{{interpolation}}`**: rejected — it is the rejected static shape with one hole patched, still without `select`, nesting or inline formatting, and it is a library convention rather than a standard, so it carries a dialect's maintenance cost with none of the translator-familiarity payoff.
- **Gettext `.po` with `ngettext`**: rejected as the model, noted as a possible export target. It is the default in several of REQUIREMENTS §1's CMS ecosystems and translators know it, but it offers cardinal plurals via a numeric index formula and nothing else — no `select`, no nesting, no inline formatting — so it is strictly weaker. Emitting `.po` from `i18n:sync` for teams that live in gettext stays available, lossy only where features gettext lacks are used.
- **Extending the ruled `{placeholder}` channel with a hand-rolled `plural`/`select` subset**: rejected — this is inventing an ICU dialect. Every hour spent on the parser, the CLDR category validation and the escaping rules is an hour the standard gives away, and the result is a format no translation tool recognizes.
- **`@messageformat/core` as the production compiler** (the obvious reading of "adopt ICU"): rejected in favor of parsing with `@messageformat/parser` and owning the AST evaluator. Compiling patterns to functions would put a third-party runtime into emitted client output — the first non-`@zeix` bytes to ship — and would give the server fold and the client evaluation two independent implementations of the same semantics, on the two sides of an equivalence this project otherwise pins. Owning one small evaluator used by both sides makes that equivalence structural; the parser, which is the hard part, is still reused. `@messageformat/core` is kept as a differential test oracle.
- **Shipping compiled message functions per locale to the client**: rejected — code cannot ride the per-instance JSON attribute, so this forces per-locale client modules, which the baked-in-map rejection below already rules out. Serializing the parsed AST gets the same capability with one universal bundle.
- **Shipping raw patterns and parsing them in the browser**: rejected — it puts an ICU parser (nested braces, escapes: the expensive part) in every client that has one reactive message, to re-derive something the build already computed.
- **Automatic extraction of all template literals**: rejected for now. It guarantees no string is forgotten, but it is substantial machinery (key stability across edits, disambiguating identical strings, a catalog edit for every text edit) and the untranslated-literal warning in sub-design 4 gets most of the benefit at a fraction of the cost. Revisit if the warning proves insufficient in practice.
- **A missing key as a build error**: rejected — it makes a partially translated locale unbuildable, so a new locale could never land incrementally. Attractive on the project's usual compile-time-contract grounds, and rejected only because translation is externally paced work.
- **A missing key as a compile warning**: rejected — it is not author-fixable, so it would sit in the warning channel indefinitely and reintroduce the non-zero baseline ADR 0029 sub-design 6 just removed.
- **Request-time content negotiation**: rejected — it needs the per-request SSR path ADR 0029 sub-design 8 declined, and it makes locale a runtime variable so no `Intl` call can fold, pushing every i18n component to the Simulated tier.
- **Tiered catalogs (global / page / component) with override precedence**: rejected — three channels able to carry the same key is the duplication smell policed everywhere else in this project, and the precedence rule it needs is the shape repeatedly rejected before. Page prose is a per-locale page source, not a catalog override, so the tier that motivated it was a category error.
- **Per-component catalog files co-located with the `.tsrx`**: rejected — it reintroduces a sibling file whose contract must be kept in sync by hand, which is precisely the three-file drift ADR 0024 exists to cure, and it hands translators N files per language instead of one. Inline source strings get the co-location benefit without the sibling file.
- **The build writing missing keys into committed catalogs** (i18next/Fluent "save missing" mode): rejected — self-maintaining and diffable, but it makes the build non-idempotent and has CI writing to tracked files. The same benefit is available from an explicit `i18n:sync` script a person runs.
- **Retiring `getLocale()` in favor of the server arg alone**: rejected — the ancestor walk is correct client-side behavior on pages Le Truc did not render, and it is the hand-written twins' documented contract. Seeding the realm addresses the divergence without deleting a working mechanism.
- **Discrete args (`lang`, `timeZone`, `currency`) instead of one record**: rejected — it multiplies the threading problem by the number of configuration axes, and the reserved-parameter mechanism makes the record free to pass.
- **Baking the per-component map into the generated client**: rejected — the client bundle is shared across locales while pages multiply per locale (sub-design 1), so baked-in translations force per-locale client bundles. Rendering the map as a per-instance attribute keeps the locale a build-time server fact and one client bundle universal.
- **A page-level JSON payload** (`<script type="application/json">`, deduplicated across instances): rejected — it needs a tag-to-instance lookup layer, cannot serve two occurrences in different locales without keying by locale anyway, and saves bytes only where an event-time string recurs per page; the attribute is per-instance the way every other rendered fact is.
- **Generalizing rendered alternatives to event-time strings** (a hidden carrier element per client string): rejected — an event-time string is never no-JS-visible, so a hidden carrier is plumbing without a progressive-enhancement payoff, and it couples the component to refs and DOM positions it would not otherwise need. Superseded by sub-design 9.

## Consequences

**Good:**

- The server has a real answer to "what locale is this page," rather than the build machine's default or an ancestor walk over a truncated tree.
- Rendered markup shrinks sharply: one element and one thunk replace six spans, six thunks, six declared keys and six translations per pluralized noun — and the hidden siblings leave the accessibility tree with them.
- Interpolation, `select`, nesting and inline number/date/currency formatting all become expressible, in a format translators and translation tooling already know. The largest capability gap in the design closes.
- The census loses a whole class of complexity: every locale carries the same key set, so reachability rules disappear from both walks, and the `<key>.<category>` shape rule and its CLDR validation go with them.
- Net maintained code drops: the parser — the hard part — is reused, and one small AST evaluator replaces both the per-category fold path and the client's selection machinery.
- **i18n components get cheaper, not more expensive.** A server-known locale folds `Intl` (LT-142), so `basic-pluralize`'s six standing `TSRX034` warnings dissolve and it becomes Folded-tier eligible instead of the Simulated tier (ADR 0029).
- ADR 0029's unresolvability limb (b) stops firing for compiled components on the locale axis: there is no runtime-default locale to be unresolvable, because the record supplies one.
- No message catalog and no locale runtime ship to the browser. The client's i18n surface is `Intl` plus the DOM — no payload, consistent with ADR 0003.
- Composition does not thread locale by hand; the reserved-parameter mechanism keeps the compose graph free of plumbing, and a component that does not want i18n pays nothing.
- The realm seeding fixes a live silent-wrong-answer bug that exists today, independent of i18n.
- Both new reporting needs reuse the census pattern rather than inventing channels, and the compile-warning zero target survives.
- The corpus's strongest untranslated strings — screen-reader status announcements built at event time — become translatable without shipping a catalog or a locale runtime (sub-design 9).
- The `i18n` attribute is absent on every component without client-referenced keys, so the payload is paid only where event-time strings exist.
- Reactive thunks read `t` directly; the hidden rendered-label read-back interim retires rather than accumulating as a second sanctioned idiom.

**Bad / accepted tradeoffs:**

- ~~**The corpus multiplies per locale.** ~3,700 component occurrences become N × 3,700, and LT-166's `(component, args)` memoization now keys on locale, so the measured 93.5% hit rate will drop — by how much depends on how many components actually consume `i18n`. This needs re-measuring when the second locale lands, and it partially offsets ADR 0029's Static-tier savings.~~ **Retracted 2026-09-07 (LT-175 measured it, LT-174 landed it).** This bullet was written against a pre-[0029](0029-tiered-server-evaluation.md) corpus and is wrong in both directions. The build's simulated stage does not see ~3,700 occurrences — tiering routes all but **4** away from the realm, and the one i18n component (`basic-pluralize`) classifies Folded exactly as sub-design 1 predicted. The 93.5% hit rate did not drop; it never applied, and at one locale the cache measured **0 hits**. Measured end to end at the second locale: **3723 ms → 3746 ms, +23 ms** — per-locale page rendering shares the Markdoc/Shiki processing across locales, so the marginal cost is template application and file writes. It does **not** offset ADR 0029's savings to any meaningful degree. The render cache was removed (LT-193, landed 2026-09-17); the corpus-scale hit rate cannot return, because 1,966 of the docs' 3,249 occurrences are `module-scrollarea`, which ADR 0029 routed off simulation permanently.
- Mixed-language pages are shippable and therefore will ship. That is the deliberate price of incremental translation, and the census is the only thing making it visible.
- The catalog pipeline (format, loading, key resolution, staleness detection, the report artifact, the `i18n:sync` script) is new build surface with no prior art in this repo.
- Source strings living inline means a source-locale copy edit is a `.tsrx` edit, which invalidates that key's translations. Staleness detection has to notice that, or translations silently drift from a source string that moved on.
- The untranslated-literal warning will fire broadly across the corpus during the i18n migration, before converging. Expect a period where the warning baseline is non-zero for a *known, closing* reason — unlike the routing signals, this one is genuinely author-fixable, so it must actually be driven to zero rather than reclassified.
- **A message with client-reactive arguments evaluates in the browser**, which narrows ADR 0024 sub-design 1 from "never client-renders" to "never renders structure client-side; may substitute a text node from a parsed pattern." The narrowing is argued in sub-design 6 and is the single largest premise this decision moves. The bytes are the parsed AST plus a narrowed evaluator, paid only by components that have such a message; they must be measured, not assumed.
- **"The catalog never reaches the client" becomes "only the parsed patterns a component's own client-reactive messages need reach the client."** Still per-instance, still opt-in by demand, still never the catalog — but no longer an absolute.
- Two build-time dependencies enter the compiler (`@messageformat/parser`, plus the skeleton packages where skeletons are used). They never reach emitted output, but they are the first place the project depends on an external parser for a *format contract* rather than a language.
- **The migration has a deadline attached and a cost that grows.** Every component authored against the retired per-category shape is a component to rewrite; the corpus is seven components at ruling time, which is why the ruling landed now.
- Two locale channels coexist (the reserved record and an authored `lang` override), which needs the precedence rule documented wherever authors will meet it. The alternative — retiring the authored `lang` — would have broken two components' published attribute contracts.
- `dir` is exposed but deliberately not rendered per component, so RTL page setup remains the page author's job. A component that assumed otherwise would be wrong in a way nothing here catches.
- The per-instance `i18n` attribute (sub-design 9) repeats per occurrence. Accepted: it is bounded by client-referenced keys only and absent on components that need no event-time strings.
- Client-created instances fall back to the source locale (sub-design 9). Accepted: the same class as a page the compiler did not render; a server render is what localizes.
- `t.<key>` is `string` for an argument-less message and a function otherwise, and its TypeScript type is the union of both until compiler-generated `.d.ts` arrives. **Authors must not rely on the wider type**: tightening it later is a breaking type change, accepted here because the surface is pre-adoption, and the obligation is a documentation one.
- The census grows two pattern-integrity walks (argument preservation, plural-arm coverage) where it lost the reachability rules. It is a simpler net shape, not a free one, and `i18n:sync` must carry patterns through unchanged and can auto-fix neither walk.
- A translator can now write a malformed pattern, a failure class the old shape made impossible. It falls back to the source pattern and reports as a census entry rather than failing the build — consistent with the missing-key ruling, and the reason a parse error cannot make a locale unbuildable.
- Committing to MF1 accepts a future MF2 migration whose cost scales with pattern and locale count. It is mechanical and vendor-supported, and the manifest rebaseline that keeps it from marking every translation stale is ruled in sub-design 5 — but it is a cost deferred, not avoided.

## Related

- Requirements: [§4 Accessibility](../REQUIREMENTS.md#accessibility) (language and direction are accessibility-relevant), [§5 Technical Constraints](../REQUIREMENTS.md#5-technical-constraints), [§7 Out of Scope](../REQUIREMENTS.md#7-out-of-scope) (the library gains no i18n surface; this is compiler/build tooling)
- Architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers)
- Host profile: [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md) (the reserved `i18n` parameter and the data account)
- Compiler: [`server/tsrx/LE_TRUC_COMPILER.md`](../server/compiler/LE_TRUC_COMPILER.md)
- Related ADRs: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (s3 one-site-three-roles and the root-attribute exclusion; s10's `children` reserved-parameter precedent; s15 the context fallback this decision declines to use), [ADR 0027](0027-server-simulation.md) (the realm whose `<html lang>` sub-design 7 seeds), [ADR 0029](0029-tiered-server-evaluation.md) (why a build-constant locale means the Folded tier, and the census pattern both new reports reuse), [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (the client reads the locale from the rendered DOM)
