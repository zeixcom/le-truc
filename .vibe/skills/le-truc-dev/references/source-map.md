# Source Map

Where to find things in the le-truc codebase. Read this before locating any source file.

## Authoritative Documents

| What you need | Where to look |
|---|---|
| Non-obvious behaviors, parser branding, security, debug mode | `ARCHITECTURE.md`, `AGENTS.md` |
| File map, lifecycle, effect system, UI query system, parser system, context protocol | `ARCHITECTURE.md` |
| Public API surface (all exports, types) | `types/index.d.ts` (generated) |
| TypeScript type declarations | `types/` |
| Domain vocabulary and term definitions | `CONTEXT.md` |
| Requirements and constraints | `REQUIREMENTS.md` |
| Architectural decisions | `adr/` |

## Source Files

Core files in `src/`:

| File | Contents |
|---|---|
| `component.ts` | `defineComponent`, `Truc` class, component lifecycle, `#setAccessor`, `FactoryContext`, `asParser`, `defineMethod`, parser/method branding |
| `effects.ts` | `makeWatch`, `makePass`, `each`, `EffectDescriptor`, `FactoryResult`, `Reactive`, `WatchHelper`, `PassHelper` |
| `events.ts` | `makeOn`, `OnHelper`, event delegation, passive event throttling |
| `bindings.ts` | `bindText`, `bindProperty`, `bindClass`, `bindVisible`, `bindAttribute`, `bindStyle`, `dangerouslyBindInnerHTML`, `safeSetAttribute`, `escapeHTML` |
| `ui.ts` | `first`, `all`, `makeElementQueries`, `createElementsMemo`, selector type inference |
| `context.ts` | `makeProvideContexts`, `makeRequestContext`, `ContextRequestEvent` |
| `scheduler.ts` | `schedule`, `throttle` — rAF-based task deduplication |
| `errors.ts` | `MissingElementError`, `DependencyTimeoutError`, `InvalidCustomElementError`, `InvalidReactivesError`, `InvalidComponentNameError` |
| `internal.ts` | `getSignals` — internal signal map shared by `component.ts` and `effects.ts` |
| `util.ts` | `log`, `LOG_ERROR`, `LOG_WARN`, `elementName`, `DEV_MODE`, `isCustomElement`, `isNotYetDefinedComponent` |

Parser files in `src/parsers/`:

| File | Exports |
|---|---|
| `boolean.ts` | `asBoolean` |
| `date.ts` | `asDate` |
| `json.ts` | `asJSON` |
| `number.ts` | `asInteger`, `asNumber`, `asClampedInteger` |
| `string.ts` | `asString`, `asEnum` |

## Quick Lookup

- Changing the component lifecycle → `src/component.ts` + `ARCHITECTURE.md`
- Changing how effects run → `src/effects.ts` + `ARCHITECTURE.md`
- Adding a new `bind*` helper → `src/bindings.ts` (follow existing pattern); export from index
- Adding a new built-in effect type → `src/effects.ts`; export from the index
- Changing parser detection or adding a parser → `src/component.ts` + `src/parsers/`; export from the index
- Changing context protocol → `src/context.ts` + `ARCHITECTURE.md`
- Changing `pass()` → `src/effects.ts` + `src/internal.ts`
- Changing event listener handling → `src/events.ts`
- Changing error conditions → `src/errors.ts`
- Changing security validation → `src/bindings.ts`
- Changing scheduler → `src/scheduler.ts`
- Checking a non-obvious behavior → `ARCHITECTURE.md` first, then source
