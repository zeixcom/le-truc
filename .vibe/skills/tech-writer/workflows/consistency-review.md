# Consistency Review

## Required Reading
references/document-map.md — consistency checks for every document

## Process
A consistency review checks that all authored documents accurately reflect the current state of the source code and examples. Work through each document in order.

### Step 1: Establish ground truth

Read these files first — they are the source of truth:

```sh
# Current exports (generated)
types/index.d.ts

# Current source files
ls src/ src/parsers/

# Current example components
ls examples/
```

### Step 2: Check `docs-src/pages/` pages

#### `examples.md`
- Every directory in `examples/` that has a `.html` file should appear in the `{% listnav %}`
- No listed component should be missing from `examples/`
- Links follow the pattern `./examples/component-name.html`

#### `api.md`
- Every symbol exported from `index.ts` that TypeDoc generates a page for has a link
- No link points to a removed symbol
- Categories and alphabetical order are correct

#### `components.md`
- `defineComponent` call signatures in examples match `src/component.ts`
- Parser names in examples match current exports (`asString`, `asBoolean`, etc.)
- `first()` / `all()` descriptions match `src/ui.ts`
- `defineMethod()` description matches `src/component.ts`
- All code examples compile against current exports in `index.ts`

#### `data-flow.md`
- `pass()` callout about Le Truc-only scope is accurate
- `createMemo`, `createState`, and other signal calls use current API; `createEventsSensor` was removed in v2.0
- `defineMethod()` description is accurate

#### `getting-started.md`
- Install command is current
- Quick-start example imports and uses current API

### Step 3: Check `README.md`

- Install command is current
- Quick-start example uses current API and compiles

### Step 4: Check `ARCHITECTURE.md`

- File map lists all files currently in `src/` and `src/parsers/` (no `src/effects/` directory in v2.0)
- No section describes a removed function or stale behavior
- Built-in helpers/effects table matches current exports from `src/bindings.ts`, `src/effects.ts`, `src/events.ts`

### Step 5: Check `AGENTS.md`

- Every entry describes behavior that is still true in the current implementation
- No entry references a removed function, symbol, or behavior

### Step 6: Check JSDoc (spot-check)

For the most recently changed source files:
- `@param` names match current signatures
- No `@param` tags reference removed parameters
- `@since` tags present on all public functions

### Step 7: Report findings

Summarise in three categories:
- **Outdated**: content that no longer reflects the current source (must fix)
- **Missing**: content that should exist but doesn't (should fix)
- **Accurate**: documents that passed their checks (no action needed)

## Success Criteria
- Every factual claim in every document checked against current source
- All outdated content identified and flagged
- All missing required content (nav list entries, JSDoc) flagged
