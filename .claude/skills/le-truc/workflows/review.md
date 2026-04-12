<required_reading>
1. references/anti-patterns.md — what to flag and fix
2. references/accessibility.md — ARIA correctness for the widget type
3. references/coordination.md — verify the right mechanism is used for inter-component communication
Read references/effects.md or references/parsers.md if specific choices seem wrong.
</required_reading>

<process>
## Step 1: Read the component

Read all files for the component being reviewed:
- `.ts` — component definition
- `.html` — inner markup and example states
- `.css` — styles
- `.md` — documentation (if present)

Do not propose changes to code you have not read.

## Step 2: Check the TypeScript

Work through references/anti-patterns.md and flag any violations. Also check:

- **Props type**: every reactive property is explicitly typed; no implicit `any`
- **Initializers**: attribute-driven props use `asString`/`asBoolean`/`asInteger`/`asNumber`/`asEnum`/`asJSON`; DOM-derived initial values are read directly before `expose()`; custom parsers wrapped with `asParser()`; method props wrapped with `defineMethod()`
- **`expose()` called once**: all props declared in a single `expose()` call before any effects
- **Return array**: every `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` is in the returned array; optional elements use the `el && watch(...)` guard pattern where appropriate (note: `on(el, ...)` and `pass(el, ...)` handle falsy targets internally — no guard required for those)
- **`on()` handlers**: return `{ prop: value }` when updating host props; return `void` for side-effects only
- **Custom `watch` handlers**: return a cleanup function if they set up listeners or timers
- **Reactivity**: DOM values read inside reactive thunks must stay current — prefer live DOM APIs (`element.children`, `getElementsByTagName`) over snapshot APIs (`querySelectorAll`, `Array.from`) when used as reactive inputs; or use `createElementsMemo` for a signal-backed collection
- **Coordination**: `pass()` used only for Le Truc-to-Le Truc bindings; `watch()` + `bindProperty()` used for all others (see references/coordination.md)

## Step 3: Check the HTML

- Native semantic elements used inside the custom element
- Markup is valid and functional without JavaScript (progressive enhancement)
- All meaningful states and variant combinations are represented as separate examples
- No inline styles or inline event handlers

## Step 4: Check the CSS

- All rules scoped to the host element tag name
- CSS nesting used for descendant selectors
- Design-token custom properties used for all colors, spacing, and typography
- Variant styles expressed as modifier classes on the host, not as separate selectors

## Step 5: Check accessibility

Follow references/accessibility.md for the widget type. Verify:
- Correct ARIA role on the appropriate element (or native element used instead)
- Interactive ARIA states (`aria-expanded`, `aria-selected`, etc.) kept in sync via `watch()` + `bindAttribute(el, name)`
- Focus management is correct for the pattern (dialogs, menus, tabs)
- Labels are present and associated

## Step 6: Check documentation

If a `.md` file is present, verify it covers the sections required by references/documentation.md for this component's feature set (properties, attributes, CSS classes, descendants, methods, events as applicable). Types and defaults must match the TypeScript source.

## Step 7: Report

Summarise findings in three categories:
- **Must fix**: correctness issues, anti-patterns, broken reactivity, broken accessibility
- **Should fix**: missing documentation, suboptimal coordination patterns
- **Optional**: only if explicitly asked — do not suggest splitting watch handlers into bind helpers, adding guards to `on`/`pass` calls, or other style preferences
</process>

<success_criteria>
- No violations from references/anti-patterns.md
- ARIA and semantics correct for the widget type
- Correct coordination mechanism in use
- No broken reactivity (snapshot DOM APIs used where live collections or signals are needed)
- Documentation complete and accurate
</success_criteria>
