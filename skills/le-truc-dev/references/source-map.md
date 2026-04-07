<overview>
Where to find things in the le-truc codebase. Read this before locating any source file.
</overview>

<authoritative_documents>
| What you need | Where to look |
|---|---|
| Non-obvious behaviors, parser branding, security, debug mode | `CLAUDE.md` |
| File map, lifecycle, effect system, UI query system, parser system, context protocol | `ARCHITECTURE.md` |
| Public API surface (all exports, types) | `types/index.d.ts` (generated; source of truth for public types) |
| TypeScript type declarations | `types/` |
| Narrative documentation (getting started, components, data flow) | `docs-src/pages/` |
</authoritative_documents>

<source_files>
Core files in `src/`:

| File | Contents |
|---|---|
| `component.ts` | `defineComponent`, `Truc` class, component lifecycle, `#setAccessor`, `FactoryContext` |
| `effects.ts` | `makeWatch`, `makePass`, `each`, `EffectDescriptor`, `FactoryResult`, `Reactive`, `WatchHandlers` |
| `events.ts` | `makeOn`, `createEventsSensor`, `FactoryOnHelper` |
| `helpers.ts` | `bindText`, `bindProperty`, `bindClass`, `bindVisible`, `bindAttribute`, `bindStyle`, `dangerouslySetInnerHTML` |
| `ui.ts` | `first`, `all`, `makeElementQueries`, `createElementsMemo`, selector type inference |
| `parsers.ts` | `Parser`/`MethodProducer` types; `isParser`, `isMethodProducer`, `asParser`, `asMethod` |
| `context.ts` | `makeProvideContexts`, `makeRequestContext`, `ContextRequestEvent` |
| `safety.ts` | `safeSetAttribute`, `setTextPreservingComments` |
| `scheduler.ts` | `schedule` — rAF-based task deduplication for passive events |
| `errors.ts` | `MissingElementError`, `DependencyTimeoutError`, `InvalidCustomElementError`, `InvalidReactivesError` |
| `internal.ts` | `getSignals` — internal signal map shared by `component.ts` and `effects.ts` |
| `util.ts` | `log`, `LOG_ERROR`, `LOG_WARN`, `elementName`, `DEV_MODE`, `isCustomElement` |

Parser files in `src/parsers/`:

| File | Exports |
|---|---|
| `boolean.ts` | `asBoolean` |
| `date.ts` | `asDate` |
| `json.ts` | `asJSON` |
| `number.ts` | `asInteger`, `asNumber`, `asClampedInteger` |
| `string.ts` | `asString`, `asEnum` |
</source_files>

<quick_lookup>
- Changing the component lifecycle → `src/component.ts` + `ARCHITECTURE.md` → "The Component Lifecycle"
- Changing how effects run → `src/effects.ts` + `ARCHITECTURE.md` → "The Effect System"
- Adding a new `bind*` helper → `src/helpers.ts` (follow existing pattern); export from `types/index.d.ts` and the index
- Adding a new built-in effect type → `src/effects.ts`; export from the index
- Changing parser detection or adding a parser → `src/parsers.ts` + `src/parsers/`; export from the index
- Changing context protocol → `src/context.ts` + `ARCHITECTURE.md` → "The Context Protocol"
- Changing `pass()` → `src/effects.ts` + `src/internal.ts`
- Changing event listener handling → `src/events.ts`
- Changing error conditions → `src/errors.ts`
- Changing security validation → `src/safety.ts`
- Checking a non-obvious behavior → `CLAUDE.md` first, then source
</quick_lookup>
