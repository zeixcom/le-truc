# Translations (ADR 0030)

One catalog file per locale, component-namespaced — **the source locale
(`en`) has no file here**: its strings live inline in each component's
`.tsrx` (`export const i18n = { key: 'Source string' }`), so the component
stays the single source of truth and no per-component catalog file exists.

```
i18n/de.json        { "basic-pluralize.remaining": "verbleibend", … }
i18n/manifest.json  per locale, per key: the source-string hash the
                    translation was recorded against (staleness detection)
```

- **No tiering** — a key resolves in exactly one place: the locale's entry,
  else the inline source string. There is no global or page layer.
- **Per-category word forms** (LT-190): a dotted key must end in a CLDR
  plural category — `basic-pluralize.task.one`, `basic-pluralize.task.other`
  — so each locale carries its own form per category (Welsh tasg/tasgiau,
  Arabic's six, English's irregular person/people). The build's translation
  census counts a category key only for locales whose platform plural set
  can actually render it: a category the locale prunes is the translator's
  nothing-to-do, not a gap. A locale carries entries for exactly its own
  reachable set — de has `{one, other}` (two entries), cy all six.
- A key absent from a locale renders the source string and is counted in
  the build's **translation census** — never a compile warning (translator
  work, not author work). The source locale declares every key its template
  references, so the fallback bytes always exist.
- When a component's source string is edited, that key's translations go
  **stale** (the manifest hash no longer matches); the census reports it.
- **`bun run i18n:sync`** writes missing keys into the locale catalogs as
  empty entries and refreshes the manifest — run it by a person; the build
  never writes these files.
