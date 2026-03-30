<overview>
Where to find things in the le-truc codebase. Read this before locating any source file.
</overview>

<authoritative_documents>
| What you need | Where to look |
|---|---|
| Non-obvious behaviors, parser branding, security, debug mode | `CLAUDE.md` |
| File map, lifecycle, effect system, UI query system, parser system, context protocol | `ARCHITECTURE.md` |
| Public API surface (all exports, types) | `src/index.ts` |
| TypeScript type declarations | `types/` |
| Narrative documentation (getting started, components, data flow) | `docs-src/pages/` |
</authoritative_documents>

<source_files>
Core files in `src/`:

| File | Contents |
|---|---|
| `component.ts` | `defineComponent`, `Truc` class, component lifecycle, `#setAccessor` |
| `effects.ts` | `runEffects`, `updateElement`, `resolveReactive`, `Effect`/`Effects`/`Reactive` types |
| `ui.ts` | `first`, `all`, `getHelpers`, `createElementsMemo`, selector type inference |
| `parsers.ts` | `Parser`/`Reader`/`MethodProducer` types; `isParser`, `isMethodProducer`, `isReader`, `asParser`, `asMethod`, `read`, `getFallback` |
| `events.ts` | `createEventsSensor` — event-delegation sensor factory |
| `context.ts` | `provideContexts`, `requestContext`, `ContextRequestEvent` |
| `scheduler.ts` | `schedule` — rAF-based task deduplication for passive events |
| `errors.ts` | `MissingElementError`, `DependencyTimeoutError`, `InvalidEffectsError` |
| `internal.ts` | `getSignals` — internal signal map shared by `component.ts` and `pass.ts` |
| `util.ts` | `log`, `LOG_ERROR`, `LOG_WARN`, `elementName`, `DEV_MODE` |

Effect files in `src/effects/`:

| File | Exports |
|---|---|
| `attribute.ts` | `setAttribute`, `toggleAttribute` |
| `class.ts` | `toggleClass` |
| `event.ts` | `on`, `EventHandler` |
| `html.ts` | `dangerouslySetInnerHTML` |
| `pass.ts` | `pass` |
| `property.ts` | `setProperty`, `show` |
| `style.ts` | `setStyle` |
| `text.ts` | `setText` |

Parser files in `src/parsers/`:

| File | Exports |
|---|---|
| `boolean.ts` | `asBoolean` |
| `json.ts` | `asJSON` |
| `number.ts` | `asInteger`, `asNumber` |
| `string.ts` | `asString`, `asEnum` |
</source_files>

<quick_lookup>
- Changing the component lifecycle → `src/component.ts` + `ARCHITECTURE.md` → "The Component Lifecycle"
- Changing how effects run → `src/effects.ts` + `ARCHITECTURE.md` → "The Effect System"
- Adding a new built-in effect → `src/effects/` (follow existing pattern); export from `src/index.ts`
- Changing parser detection or adding a parser → `src/parsers.ts` + `src/parsers/`; export from `src/index.ts`
- Changing context protocol → `src/context.ts` + `ARCHITECTURE.md` → "The Context Protocol"
- Changing `pass()` → `src/effects/pass.ts` + `src/internal.ts`
- Changing error conditions → `src/errors.ts`
- Changing security validation → `src/effects/attribute.ts`
- Checking a non-obvious behavior → `CLAUDE.md` first, then source
</quick_lookup>
