# Review Workflow

**Use when:** Reviewing or extending an existing Le Truc component.

**Required reading first:**
- `references/anti-patterns.md` — what to flag and fix
- `references/accessibility.md` — ARIA correctness for the widget type
- `references/coordination.md` — verify correct inter-component mechanism

Read `references/effects.md` or `references/parsers.md` if specific choices seem wrong.

---

## Step 1: Read the Component

Read **all files** for the component being reviewed:
- `.ts` — component definition
- `.html` — inner markup and example states
- `.css` — styles
- `.md` — documentation (if present)

**Do not propose changes to code you have not read.**

---

## Step 2: Check TypeScript

Work through `references/anti-patterns.md` and flag any violations. Also verify:

- **Props type:** every reactive property explicitly typed; no implicit `any`
- **Initializers:** attribute-driven props use correct parsers (`asString`, `asBoolean`, `asInteger`, `asNumber`, `asEnum`, `asJSON`); DOM-derived initial values read directly before `expose()`; custom parsers wrapped with `asParser()`; method props wrapped with `defineMethod()`
- **`expose()` called once:** all props declared in single `expose()` call before any effects
- **Return array:** every `watch()`, `on()`, `pass()`, `each()`, `provideContexts()` in returned array; optional elements use `el && watch(...)` guard (note: `on(el, ...)` and `pass(el, ...)` handle falsy targets internally — no guard required)
- **`on()` handlers:** return `{ prop: value }` when updating host props; return `void` for side-effects only
- **Custom `watch` handlers:** return cleanup function if they set up listeners or timers
- **Reactivity:** DOM values read inside reactive thunks stay current — prefer live DOM APIs (`element.children`, `getElementsByTagName`) over snapshot APIs (`querySelectorAll`, `Array.from`); or use `createElementsMemo` for signal-backed collection
- **Coordination:** `pass()` used only for Le Truc-to-Le Truc bindings; `watch()` + `bindProperty()` for all others

---

## Step 3: Check HTML

- Native semantic elements used inside custom element
- Markup valid and functional without JavaScript (progressive enhancement)
- All meaningful states and variant combinations represented as separate examples
- No inline styles or inline event handlers

---

## Step 4: Check CSS

- All rules scoped to host element tag name
- CSS nesting used for descendant selectors
- Design-token custom properties used for all colors, spacing, typography
- Variant styles expressed as modifier classes on host, not separate selectors

---

## Step 5: Check Accessibility

Follow `references/accessibility.md` for widget type. Verify:

- Correct ARIA role on appropriate element (or native element used)
- Interactive ARIA states (`aria-expanded`, `aria-selected`, etc.) kept in sync via `watch()` + `bindAttribute(el, name)`
- Focus management correct for pattern (dialogs, menus, tabs)
- Labels present and associated

---

## Step 6: Check Documentation

If `.md` file present, verify it covers sections required by `references/documentation.md` for component's feature set (properties, attributes, CSS classes, descendants, methods, events as applicable). Types and defaults must match TypeScript source.

---

## Step 7: Report

Summarize findings in three categories:

- **Must fix:** correctness issues, anti-patterns, broken reactivity, broken accessibility
- **Should fix:** missing documentation, suboptimal coordination patterns
- **Optional:** only if explicitly asked — do not suggest splitting watch handlers into bind helpers, adding guards to `on`/`pass` calls, or other style preferences

---

## Success Criteria

- No violations from `references/anti-patterns.md`
- ARIA and semantics correct for widget type
- Correct coordination mechanism in use
- No broken reactivity (snapshot DOM APIs used where live collections/signals needed)
- Documentation complete and accurate
