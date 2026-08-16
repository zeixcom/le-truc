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
| `component.ts` | `defineComponent`, `Truc` class, component lifecycle, `#setAccessor`, `#initSignals`, `FactoryContext`, parser/method dispatch via `isParser`/`isMethodProducer` |
| `types.ts` | `Parser`, `MethodProducer`, `asParser`, `defineMethod`, `isParser`, `isMethodProducer`, parser/method branding (`PARSER_BRAND`/`METHOD_BRAND`), `ComponentProps`, `EffectDescriptor`, `FactoryResult`, `Falsy`, `ReservedWords` |
| `helpers/reactive.ts` | `makeWatch`, `makePass`, `each`, `reconcile`, `activateResult`, `forEachUnseen`, `keyedScopes`, `EffectDescriptor`, `FactoryResult`, `Reactive`, `WatchHelper`, `PassHelper` |
| `helpers/events.ts` | `makeOn`, `OnHelper`, event delegation, passive event throttling |
| `bindings.ts` | `bindText`, `bindProperty`, `bindClass`, `bindVisible`, `bindAttribute`, `bindStyle`, `dangerouslyBindInnerHTML`, `safeSetAttribute`, `escapeHTML`, `setTextPreservingComments` |
| `helpers/dom.ts` | `first`, `all`, `makeElementQueries`, `createElementsMemo`, selector type inference |
| `helpers/context.ts` | `makeProvideContexts`, `makeRequestContext`, `ContextRequestEvent` |
| `scheduler.ts` | `schedule`, `throttle` — rAF-based task deduplication |
| `errors.ts` | `MissingElementError`, `DependencyTimeoutError`, `InvalidCustomElementError`, `InvalidPassPropertyError`, `InvalidPropertyNameError`, `InvalidReactivesError`, `InvalidSelectorError`, `InvalidTemplateError`, `InvalidComponentNameError`, `NoActiveCollectorError`, `ExtensionCollisionError` |
| `internal.ts` | `getSignals` — internal signal map shared by `component.ts` and `helpers/reactive.ts`; `withCollector`, `pushDescriptor`, `installActiveCollector`/`restoreActiveCollector` (ADR 0018 ambient effect-descriptor collector) |
| `util.ts` | `elementName`, `isCustomElement`, `isNotYetDefinedComponent` — DEV diagnostics are gated per-site by `process.env.DEV_MODE === 'true'`, folded out by the build define |
| `extension.ts` | `ComponentExtension` type, `mergeExtensions` — folds an extensions array into `staticProps`/`observedAttributes`/`reservedMembers` plus lifecycle hooks, called once by `component.ts` at class-definition time |
| `extensions/form.ts` | `formAssociated`, `formAssociatedCheckbox`, `relayValidity` |
| `extensions/attributes.ts` | `observedAttributes` |
| `extensions/debug.ts` | `debug`, `debugFire`, `markIfDebugging` — `DEV_MODE`-only per-instance instrumentation (ADR 0022); not exported from `index.ts`, statically imported and auto-appended by `component.ts` itself (see `non-obvious.md`) |

Parser files in `src/parsers/`:

| File | Exports |
|---|---|
| `boolean.ts` | `asBoolean` |
| `json.ts` | `asJSON` |
| `number.ts` | `asInteger`, `asNumber`, `asClampedInteger` |
| `string.ts` | `asString`, `asEnum` |

## Quick Lookup

- Changing the component lifecycle → `src/component.ts` + `ARCHITECTURE.md`
- Changing how effects run → `src/helpers/reactive.ts` + `ARCHITECTURE.md`
- Adding a new `bind*` helper → `src/bindings.ts` (follow existing pattern); export from index
- Adding a new built-in effect type → `src/helpers/reactive.ts`; export from the index
- Changing parser detection or adding a parser → `src/types.ts` + `src/parsers/`; export from the index
- Changing context protocol → `src/helpers/context.ts` + `ARCHITECTURE.md`
- Changing `pass()` → `src/helpers/reactive.ts` + `src/internal.ts`
- Changing event listener handling → `src/helpers/events.ts`
- Changing error conditions → `src/errors.ts`
- Changing security validation → `src/bindings.ts`
- Changing scheduler → `src/scheduler.ts`
- Adding or changing a `ComponentExtension` → `src/extension.ts` (merge mechanics) + `src/extensions/*.ts` (the extension itself) + `ARCHITECTURE.md`
- Changing `debug()` instrumentation → `src/extensions/debug.ts`; see `non-obvious.md` before touching its static import in `component.ts`
- Checking a non-obvious behavior → `ARCHITECTURE.md` first, then source
