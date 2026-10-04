# Translations (ADR 0030)

One catalog file per locale, component-namespaced — **the source locale
(`en`) has no file here**: its strings live inline in each component's
authored source (`export const i18n = { key: 'Source string' } as const`), so the component
stays the single source of truth and no per-component catalog file exists.

```
i18n/de.json        { "basic-pluralize.remaining": "verbleibend", … }
i18n/manifest.json  per locale, per key: the source-string hash the
                    translation was recorded against (staleness detection)
```

- **No tiering** — a key resolves in exactly one place: the locale's entry,
  else the inline source string. There is no global or page layer.
- **One ICU MessageFormat 1 pattern per key.** Plural morphology lives
  inside the pattern, so each locale spells only its own arms in one entry.
  The cardinal arm of `basic-pluralize.tasks` is `{count, plural, one
  {Aufgabe} other {Aufgaben}}` in de; cy spells all six categories. Every
  locale carries the same key set. The census checks each translation against
  its source pattern: the arguments must match, and every `plural` must
  cover the locale's CLDR categories.
- A catalog entry that no component declares is **orphaned**: it can never
  render, and the census reports it in every locale.
- A key absent from a locale renders the source string and is counted in
  the build's **translation census** — never a compile warning (translator
  work, not author work). The source locale declares every key its template
  references, so the fallback bytes always exist.
- When a component's source string is edited, that key's translations go
  **stale** (the manifest hash no longer matches); the census reports it.
- **`bun run i18n:sync`** writes missing keys into the locale catalogs as
  empty entries, prunes orphaned keys, and refreshes the manifest — run it
  by a person; the build never writes these files. A catalog file that does
  not parse as a JSON object (a trailing comma, a merge-conflict marker) is
  one `malformed` census record, and sync refuses it: the file and its
  manifest entries stay untouched, and sync exits non-zero naming it.
