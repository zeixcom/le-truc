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
- A key absent from a locale renders the source string and is counted in
  the build's **translation census** — never a compile warning (translator
  work, not author work).
- When a component's source string is edited, that key's translations go
  **stale** (the manifest hash no longer matches); the census reports it.
- **`bun run i18n:sync`** writes missing keys into the locale catalogs as
  empty entries and refreshes the manifest — run it by a person; the build
  never writes these files.
