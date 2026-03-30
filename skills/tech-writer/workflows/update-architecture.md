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
| `attributeChangedCallback` behavior | "The Component Lifecycle" → "attributeChangedCallback" |
| `runEffects` or `updateElement` | "The Effect System" |
| `first()`, `all()`, or dependency resolution | "The UI Query System" |
| Parser/Reader/MethodProducer detection | "The Parser System" |
| `createEventsSensor` | "Event-Driven Sensors" |
| `provideContexts`/`requestContext` | "The Context Protocol" |
| `schedule()` | "The Scheduler" |
| `setAttribute` security rules | "Security" |

## Step 3: Describe mechanisms, not intentions

State what the code does. Not "this enables efficient updates" but "when `resolveReactive` returns `undefined`, `updateElement` restores the fallback captured at setup time."

Pseudocode diagrams and inline function references are appropriate. Match actual source structure exactly — do not simplify.

## Step 4: Update the built-in effects table if effects changed

The "Built-in effects at a glance" table in "The Effect System" section must list every effect exported from `src/effects/`. If an effect was added, removed, or renamed, update the table row.
</process>

<success_criteria>
- File map matches actual files in `src/`, `src/effects/`, `src/parsers/`
- Lifecycle description matches `src/component.ts`
- Effects table matches current effect exports
- No section describes a removed function or a changed mechanism inaccurately
- Register is technical and precise — mechanism described, not motivation
</success_criteria>
