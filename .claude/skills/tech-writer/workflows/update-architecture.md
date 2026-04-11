<required_reading>
1. references/document-map.md → `<ARCHITECTURE_md>`
2. references/tone-guide.md → `<ARCHITECTURE>` section
3. The relevant source file(s) in `src/` — read before writing
</required_reading>

<process>
## Step 1: Read `ARCHITECTURE.md` and the source

Read the full `ARCHITECTURE.md`. Then read the source file(s) that changed. Do not update from memory.

## Step 2: Update the affected section(s)

Match the change type to the section:

| What changed | Section to update |
|---|---|
| File added/removed from `src/` | "File Map" and "Dependency Graph" |
| `connectedCallback` initialization order | "The Component Lifecycle" → "connectedCallback" |
| `#setAccessor` signal creation | "The Component Lifecycle" → "#setAccessor" |
| `makeWatch`, `makeOn`, `makePass`, or `each` | "The Effect System" |
| `first()`, `all()`, or dependency resolution | "The UI Query System" |
| Parser/Reader/MethodProducer detection | "The Parser System" |
| `createEventsSensor` | "Event-Driven Sensors" |
| `provideContexts`/`requestContext` | "The Context Protocol" |
| `schedule()` | "The Scheduler" |
| `setAttribute` security rules | "Security" |

## Step 3: Describe mechanisms, not intentions

State what the code does. Not "this enables efficient updates" but "when `watch(source, handler)` re-runs and the resolved value is `undefined`, the handler is not called and the previous DOM state is preserved."

Pseudocode diagrams and inline function references are appropriate. Match actual source structure exactly — do not simplify.

## Step 4: Update the helpers and effects tables if they changed

The "Built-in helpers at a glance" table in "The Effect System" section must list every `bind*` helper exported from `src/helpers.ts`, and every `EffectDescriptor`-producing function from `src/effects.ts` and `src/events.ts`. If a helper was added, removed, or renamed, update the table.
</process>

<success_criteria>
- File map matches actual files in `src/` and `src/parsers/` (no `src/effects/` directory in v2.0)
- Lifecycle description matches `src/component.ts`
- Helpers and effects tables match current exports from `src/helpers.ts`, `src/effects.ts`, `src/events.ts`
- No section describes a removed function or a changed mechanism inaccurately
- Register is technical and precise — mechanism described, not motivation
</success_criteria>
