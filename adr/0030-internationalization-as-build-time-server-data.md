# ADR 0030: Internationalization as Build-Time Server Data

## Status

✅ Accepted

## Context

The client is the wrong layer to answer "what language is this page in": by the time it runs, the answer is in the DOM. Once the compiler renders pages, the build must answer right first. A wrong fallback is the wrong language, permanently, without JavaScript. Three corpus facts:

- `basic-pluralize` worked by accident: `lang` as a server arg, materialized on the root, read back ([ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s3's one site, three roles).
- The realm gave silent wrong answers: the simulated document had no `<html lang>`, so locale walks saw only the component's own attribute.
- A client-varied translation must not pull a catalog across the wire.

## Decision

**Locale and translations are build-time server data**: a server arg like any other, never the context protocol, never a shipped catalog.

1. **One SSG page per locale; locale is a build-time constant.** Pages multiply under a locale path prefix; derived fragment trees stay single-copy. A build-constant locale makes `Intl` fold, so i18n components are eligible for the Folded tier ([ADR 0029](0029-tiered-server-evaluation.md)). The general model is the render function called per locale. SSG is what gets built; per-request is not foreclosed.

2. **The reserved `i18n` parameter — callers never pass it** (the `children` precedent, ADR 0024 s10). It is an ordinary destructurable server arg: server-known, honest TypeScript. The record carries:
   - `lang` (BCP 47);
   - `t` (resolved messages, sub-design 4);
   - `timeZone` and `currency` (Intl defaults; a phrase needing different formatting states it inline);
   - `dir` (logic only — direction belongs on `<html>`).

   `timeZone` makes dates foldable. Date-only values use `Date.UTC` + `'UTC'`, reading no build-machine state.

3. **Locale precedence, strongest first: explicit `lang` arg > parent effective locale (compose-graph inheritance) > component default > page locale** (on a page, an occurrence's nearest positional `[lang]` ancestor precedes the page locale). `lang` cannot be a reactive property: it is a built-in IDL property, so `expose()` skips it silently, and the attribute is the only channel. A compiled component materializes its walked locale onto the root at connect, fixed for the connection (no re-walk on ancestor change). Server- and client-authored instances converge on one DOM shape. The root value rides ADR 0024 s3's root-attribute exclusion.

4. **The component declares its keys; the build resolves them.** Keys are declared with their source strings inline: a single source of truth, no sibling file to drift. Literal prose stays literal. Untranslated prose inside a catalog-using component warns (author-fixable — zero-warning target). **A message value is an ICU MessageFormat 1 pattern**: a string when argument-less, a function of its arguments otherwise. Patterns parse at build. **One AST evaluator, ours, serves fold and client**, so the sides cannot disagree (`@messageformat/core` is only a test oracle). `t` is typed **per key**: the record is declared `as const` and annotated `I18n<typeof i18n>`. The compiler rewrites the annotation in each generated module to the record its parse knows. An argument-set change type-errors every call site, and argument checking is a build-time diagnostic. There is no fallback chain and no catalog tiering: a key resolves exactly or not at all. Plural morphology lives inside the pattern. Translations are additive override files, one per language (`i18n/de.json`), with keys namespaced by component tag.

5. **A missing key falls back to the source locale and is reported, not warned.** The build report carries a **translation census** per locale: missing, stale, and orphaned keys (both directions walked; an undeclared entry can never render). It also carries pattern-integrity walks: argument preservation and plural-arm coverage against the platform's `pluralCategories`. A pattern that fails to parse renders the source string; a typo must not make a locale unbuildable. This is deliberately not a warning. Translation is externally paced, and a standing non-zero baseline is what ADR 0029 s6 eliminated. The build stays read-only: writing and pruning catalogs is an explicit `i18n:sync` script. A wholesale format migration is the one sanctioned manifest rebaseline.

6. **The client gets the locale from the DOM and recomputes the message.** The locale reaches the client through the root `lang` attribute. A message with a client-reactive argument is **recomputed** from the pattern, not selected among pre-rendered alternatives. The server renders the initial form, and the client re-evaluates on change (sub-design 9).

7. **`getLocale` survives; the realm gets seeded.** The driver seeds the simulated document's `<html lang>` from the page locale, which fixes the silent wrong answers. `getLocale()` is not retired — it is correct on unrendered pages — but the reserved parameter is canonical for compiled components.

8. **The library boundary is unchanged.** `@zeix/le-truc` gains no i18n surface (ADR 0024 s7). MessageFormat dependencies stay build-time: the client receives a parsed AST plus a compiler-inlined evaluator, never a third-party byte.

9. **Client-side messages ride a per-instance `i18n` attribute.** The channel is decided by one question: are all of a message's arguments known to the build? Server-known ones fold — the overwhelming majority. Client-reactive or event-time messages ride the attribute. The build serializes the **parsed AST** of client-referenced keys only — never the pattern (that needs a client parser), never functions (those need per-locale modules). It serializes per render call through the same per-locale record, so **one bundle serves every locale**. The attribute is absent when unused. The preamble parses it at connect (guarded `JSON.parse`) and merges it over the declared record; `t` is fixed for the connection. A client-created instance speaks the source locale. Boundaries: `t.<key>` reads compile in client positions; `lang` stays server-only; computed `t[dynamicKey]` stays rejected.

## Alternatives Considered

- **Locale via the context protocol**: a fallback channel is the wrong language permanently without JavaScript.
- **Caller-passed literals**: parents would know children's internal keys; duplicated per call site.
- **Per-category keys and rendered alternatives**: no interpolation or `select`; a cross product of spans per sentence.
- **MessageFormat 2**: tooling speaks MF1 natively, MF2 partially; `{$token}` breaks the ruled channel — migration stays open, and tested: every corpus pattern must round-trip MF1 → MF2 byte-identically (LT-253, `server/tests/compiler/MF2_EXIT.md`). The exit is upstream conversion plus two tested normalizations, not upstream alone.
- **Fluent, i18next suffix keys, gettext `.po`, hand-rolled ICU subsets**: runtime interpreters, dialects, or strictly weaker formats.
- **`@messageformat/core` in production**: third-party bytes, two implementations of one equivalence; own the evaluator, reuse the parser.
- **Per-locale functions or raw patterns**: per-locale bundles or a client ICU parser; the parsed AST rides the universal attribute.
- **Automatic extraction, missing-key errors/warnings**: heavy machinery; unbuildable partial locales or a standing non-author-fixable warning.
- **Request-time content negotiation**: the declined per-request path; unfolds every `Intl` call.
- **Discrete args, baked maps, page payloads, carrier elements**: threading, per-locale bundles, lookup layers — the record and its attribute avoid all four.

## Consequences

**Good:**

- Page locale gets a real server answer, and i18n components get cheaper (folded `Intl`). The realm fix lands regardless.
- Markup shrinks: one element/thunk replaces six per pluralized noun, and hidden siblings leave the a11y tree.
- Messages get full expressiveness in a translators' format; uniform key sets end the census's reachability rules.
- No catalog or locale runtime ships, composition never threads locale, and event-time strings become translatable.

**Bad / accepted tradeoffs:**

- Per-locale multiplication measured +23 ms at the second locale.
- Mixed-language pages ship mid-translation; only the census makes that visible.
- New build surface. A source copy edit invalidates its translations, and staleness detection must catch it.
- "Never client-renders" narrows to "never renders structure" — the largest moved premise. "Catalog never ships" becomes "only client-referenced patterns ship".
- Two build-time parser dependencies (the first on a format contract).
- Per-category rewrites are owed; malformed patterns fall back and report; MF1 defers an MF2 migration.
- The corpus may author only the MF1 the exit carries: seven supported constructs are gated out, the record's default `currency` (s2) among them. The gate binds the corpus, not downstream authors.

## Related

- Requirements [§4](../REQUIREMENTS.md#accessibility), §5, §7 — the library gains no i18n surface; architecture: [Server Evaluation Tiers](../ARCHITECTURE.md#server-evaluation-tiers), host profile: [HOST_PROFILE.md](../server/compiler/HOST_PROFILE.md), compiler: [LE_TRUC_COMPILER.md](../server/compiler/LE_TRUC_COMPILER.md)
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (locale from the DOM), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (one site, three roles; reserved parameter), [ADR 0027](0027-server-simulation.md) (seeded realm), [ADR 0029](0029-tiered-server-evaluation.md) (tiers; census)
