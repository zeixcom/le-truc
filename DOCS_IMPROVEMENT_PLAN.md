# Documentation Improvement Plan

Based on four Context 7 benchmark gaps identified in issues #24–#27.

---

## Overview

The benchmark exposed four scenarios where the documentation provides incomplete or misleading context for AI coding assistants (and developers following the same mental model). The common thread: each scenario sits at an intersection between two topics — the docs handle each topic in isolation but never show them working together.

| Issue | Gap | Affected Page(s) |
|---|---|---|
| #24 ✅ | CSS and JS shown as separate concerns; no example bridging them | `styling.md`, `components.md` |
| #25 ✅ | `setProperty()` is undocumented in prose; native element binding has no example | `data-flow.md` |
| #26 | `all()` is described but no focused list-rendering walkthrough exists | `components.md`, `data-flow.md` |
| #27 ✅ | Docs frame components as new definitions only; progressive enhancement of existing HTML is never modeled | `getting-started.md`, `components.md` |

---

## Issue #24 ✅ — Bridging CSS and JavaScript

### Diagnosis

The `styling.md` page covers CSS scoping patterns, design tokens, and class variants in isolation. The `components.md` page covers `toggleClass()`, `setAttribute()`, and other effects in isolation. Neither page shows how they work together: how a reactive boolean drives a CSS class that has rules defined for it.

The benchmark evaluator called this out directly: *"only CSS styling patterns without any JavaScript logic or API definitions."* An AI asked to implement a Le Truc component with CSS-driven state (e.g., a button with an `active` class) would not have enough context to connect the two.

### What Needs to Change

**`styling.md` — New section: "Reactive Styles"**

Add a section between "Defined Variants with Classes" and "CSS-only Components" that explicitly connects CSS class variants to `toggleClass()` effects. The section should:
- Show the CSS class rule first (e.g., `my-button { &.active { ... } }`)
- Show the matching `toggleClass('active')` effect in the component JS
- Explain that the class name in CSS must match the token passed to `toggleClass()`
- Briefly note `setAttribute()` for attribute-driven CSS (e.g., `[aria-selected="true"]`)

A concrete, minimal example that lives inside `styling.md` is essential — do not just cross-link to `components.md`. The reader's mental model at this point is "how do I style this thing reactively?", not "what effects are available?"

**`components.md` — Improve the effects examples**

The "Applying Effects" subsection currently shows bare usage but no associated CSS. Add a callout or inline note for `toggleClass()` and `setAttribute()` that explicitly says: "the class/attribute name must correspond to a CSS rule for this effect to visually do anything." Link to the Styling page's new Reactive Styles section.

### Example Component Needed

A new or revised example that is simple enough to show in a short inline demo and that uses **both** CSS and `toggleClass()` together. A good candidate: a toggle button with an `active` or `pressed` class that changes background color. This does not need to be a full named example component — it can be an inline demo within `styling.md`.

Alternatively, an existing examples like `module-scrollarea` or `module-tabgroup` could be used to serve this purpose.

---

## Issue #25 ✅ — Bidirectional Binding with `setProperty()`

### Diagnosis

The `pass()` function is well-documented and correctly described as Le Truc-only. The one-sentence note in a callout box in `data-flow.md` mentions `setProperty()` as the alternative for native elements, but there is no prose explanation, no usage example, and no API reference beyond the type signature.

The benchmark task was a range slider with two-way synchronization — a common real-world use case. The existing `form-spinbutton` example actually uses `setProperty()` extensively (setting `value`, `max`, `disabled`, `ariaLabel` on native inputs and buttons), but this example is too complex to be a teaching vehicle.

The gap: **no documentation explains that `setProperty()` is how you reactively sync state back to a native HTML element's DOM property** (distinct from its attribute). Developers working with `<input>`, `<select>`, `<video>`, or other native elements that expose JS properties would not know to use it.

### What Needs to Change

**`components.md` — New subsection in "Synchronizing State with Effects": "Bidirectional Binding with Native Elements"**

The bidirectional pattern belongs in `components.md`, not `data-flow.md`. `data-flow.md` is about coordination *between* components; bidirectional binding with a native element is about a single component managing state in sync with its own native descendant. Insert the new subsection before "Efficient & Fine-Grained Updates".

The subsection should:
- Explain the bidirectional pattern: read initial state from the DOM, update state on user events, sync state back to the element with `setProperty()`
- Use `form-checkbox` as the teaching example — it's the minimal, real implementation: `read()` for initial state, `on('change', ...)` to capture user input, `setProperty('checked')` to drive the native checkbox back
- Explain why `setProperty()` is needed instead of `setAttribute()`: setting `.checked = true` is not the same as `setAttribute('checked', '')` — only the JS property setter reflects current runtime state on native form elements
- Note common properties that require `setProperty()`: `checked`, `value`, `disabled`, `readOnly`, `selectedIndex`, `ariaLabel`, `ariaExpanded`, `ariaDisabled`

**No new example component needed** — `form-checkbox` is the right teaching vehicle.

**The `data-flow.md` callout** already correctly mentions `setProperty()` as the alternative for non-Le Truc elements. No change needed there beyond a link to the new `components.md` subsection.

---

## Issue #26 — Dynamic Lists with `all()`

### Diagnosis

The `all()` selector is documented in `components.md` (under "Selecting Elements") and used in `data-flow.md` (module-catalog's `spinbuttons` collection). Neither shows it as the mechanism for *rendering* a list — they show it as a way to observe existing static children.

The benchmark task was "implement a dynamic list component." The `module-list` example *is* the right answer, but it uses `asMethod()` for `add` and `delete`, which is a non-obvious pattern explained nowhere in the narrative docs. The gap is not just missing examples — the documentation doesn't have a conceptual bridge between "reactive collection of elements" and "component that manages a dynamic list."

### What Needs to Change

**`components.md` — Expand the `all()` section**

The current `all()` documentation focuses on observation and lazy MutationObserver behavior. Add an explanation of how `all()` supports *render* patterns: when new items are added to the container (e.g., via `container.append()`), `all()` re-evaluates and effects are applied to newly matched elements. This is the "list rendering" mental model that is missing.

Include a minimal inline example of:
1. A component with a `[data-container]` element and a `<template>`
2. A method that clones the template and appends to the container
3. `all('[data-item]')` picking up new elements and applying per-item effects

**`data-flow.md` — New section: "Managing Dynamic Lists"**

Add a section (between the existing Component Coordination section and Providing Context) that walks through the list pattern end-to-end:
- Server-rendered initial items in a container
- Adding and removing items at runtime
- Using `all()` to observe the live collection
- Applying per-item effects (e.g., `setText()`, `on('click', ...)` per item)
- The cleanup behavior: effects on removed items are automatically cleaned up

This section should reference or embed the `module-list` example (simplified).

**The `asMethod()` pattern needs prose documentation**

`module-list` uses `asMethod()` to expose `add` and `delete` as callable methods on the host element. This pattern is not explained anywhere in the narrative docs. Add a brief explanation — either in the `data-flow.md` new section or in `components.md` under a new "Exposing Methods" subsection — covering:
- When to use `asMethod()` vs a state signal
- How the method is initialized and called
- That the method is a `MethodProducer` (branded) and should always use `asMethod()`

### Example Component Needed

The existing `module-list` example is good but complex. The architect should evaluate whether a **simpler standalone list example** (without the `form-textbox` and `basic-button` dependencies) would better serve as a documentation teaching vehicle. Options:

1. **Simplify `module-list`** into a self-contained `basic-list` example with minimal dependencies, suitable for inline embedding in `data-flow.md`
2. **Keep `module-list` as-is** and reference it from new prose, accepting that the full example is more complex than needed for illustration

---

## Issue #27 ✅ — Progressive Enhancement of Existing HTML

### Diagnosis

All Le Truc documentation frames components as new elements you define and instantiate. The progressive enhancement angle — the fact that Le Truc is designed to enhance *existing server-rendered HTML* — is present as a philosophy statement but never demonstrated with a concrete scenario.

The benchmark task was: "progressively enhance an existing `<div id='dynamic-area'>`." This revealed a conceptual gap: Le Truc uses custom elements (hyphenated tag names) and cannot directly enhance a `<div>` via `defineComponent`. But the *spirit* of the question — "I have existing HTML and want to add reactivity without rewriting it" — is exactly Le Truc's primary use case, and the docs don't address it.

The benchmark score breakdown tells the story clearly: API accuracy was 25/25, but relevance was 12/25 and completeness for the scenario was 6/25. The API is documented correctly; it just doesn't map to the "I have existing HTML" mental model.

### What Needs to Change

**`getting-started.md` — Add a "Progressive Enhancement" framing section**

Before or after "Creating Your First Component", add a section that explicitly addresses the "I have existing HTML" scenario:
- Explain that Le Truc components *wrap* existing server-rendered HTML — the HTML inside the custom element is the starting point, not a blank slate
- Show that the `<basic-hello>` example already has meaningful, visible HTML (`Hello, World!`) before any JavaScript runs — it's progressive enhancement
- Explain the upgrade lifecycle: HTML is parsed and visible → JS loads → component connects → effects run
- Address the `<div id="dynamic-area">` scenario directly: you wrap it in a custom element (`<dynamic-area>`) or place the component element as a parent, keeping your existing `div` inside as a child that Le Truc queries via `first()` or `all()`

**`components.md` — Add a "Progressive Enhancement" callout in the Defining a Component section**

Add a callout near the top of the Components page that frames the mental model: Le Truc components are wrappers that enhance existing HTML children, not containers that render HTML from scratch. Link to the getting-started.md new section.

**Rename or reframe the "Anatomy of a Component" example**

The `basic-hello` example is actually a perfect progressive enhancement demo — the output says "World" before JS runs. But the docs don't call this out. Add a note that the `<output>World</output>` content is the server-rendered fallback and is visible before the component upgrades, and that `asString(ui => ui.output.textContent)` reads this fallback as the initial signal value.

### Example Component Needed

The existing `basic-hello` example is sufficient if the surrounding prose is updated correctly. However, a more compelling demonstration of progressive enhancement might be a new example that shows:
- A component with meaningful visible HTML before upgrade (not just placeholder text)
- A clear before/after: "this is what the user sees without JS" vs "this is what Le Truc adds"

This is a narrative example question more than a new component — the architect should advise whether a new example component is warranted or whether reframing existing ones is sufficient.

---

## Cross-Cutting Documentation Improvements

Beyond the four specific issues, the benchmark analysis surfaces a general pattern worth addressing:

### `setProperty()` vs `setAttribute()` — Missing Decision Guidance

Both effects are used throughout the codebase but there is no documentation explaining when to use which. Add a comparison table or decision callout in `components.md` under "Synchronizing State with Effects":

| You want to… | Use |
|---|---|
| Set an HTML attribute (string, visible in DevTools) | `setAttribute()` |
| Set a JS object property (typed, not always reflected) | `setProperty()` |
| Toggle a boolean attribute | `toggleAttribute()` |
| Toggle a CSS class | `toggleClass()` |
| Set an inline style | `setStyle()` |

### API Reference Coverage for Effects

Several effects (`setProperty`, `toggleClass`, `setAttribute`, `show`) have minimal API docs with no usage examples. Each should have at least one realistic code snippet. This is lower priority than the prose improvements above but would improve AI assistant context retrieval scores.

---

## Priority Order

1. **#27 (Progressive enhancement)** — Conceptual framing; high leverage, minimal new content needed. Fixes the 6/25 completeness score.
2. **#25 (setProperty / bidirectional binding)** — Missing pattern with a concrete new example needed. Direct unblock for a common use case.
3. **#24 (CSS + JS integration)** — New section in styling.md with a small inline demo. Medium effort.
4. **#26 (Dynamic lists)** — Most complex; requires both prose and architect decision on example simplification.
