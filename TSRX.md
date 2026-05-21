# TSRX Target for Le Truc — Feasibility Plan

> **Status**: Proposal / pre-implementation feasibility assessment  
> **Scope**: Deliberate extension of Le Truc beyond its current browser-only boundary

---

## Goal

Enable co-location of HTML template, behavioral factory code, and CSS in a single `.tsrx` source file for Le Truc components. A custom Bun plugin compiles each `.tsrx` file into three artifacts:

| Artifact | Used by | How |
|---|---|---|
| Static HTML | Server / CMS / static site | Embedded in page templates |
| Le Truc JS | Browser | `defineComponent()` factory, bundled with the rest of the app |
| CSS | Browser | Extracted and bundled as component styles |

This is a deliberate extension of Le Truc's scope. Le Truc has always assumed that server-rendered HTML exists before the browser component activates — TSRX becomes the **server-side companion** that produces that HTML. The two layers are sequential, not competing:

1. **Build time** — TSRX component renders HTML template (Bun, server-side)
2. **Browser connect time** — Le Truc factory activates on that HTML (same component, different code path)

---

## TSRX Capabilities (from `https://tsrx.dev/llms.txt`)

TSRX is a TypeScript language extension that adds:
- The `component` keyword with JSX-as-statements in the body
- First-class control flow: `if`/`else`, `for ... of` (with `key`), `switch`, `try`/`catch`/`pending`
- Scoped `<style>` blocks (CSS extracted as virtual CSS modules)
- Lazy destructuring (`&{ }`, `&[ ]`) for reactivity-preserving prop access
- Lexical template scoping (locals declared inside element bodies)

It compiles `.tsrx` → target-specific output via a **two-loader Bun/Vite/Rspack plugin**:
1. **JS loader**: `.tsrx` → target TSX/code
2. **CSS loader**: extracts `<style>` blocks as sibling virtual CSS modules (`?tsrx-css&lang.css`)

Existing targets: React, Preact, Solid, Vue, Ripple. All are client-side rendering frameworks.

**`@tsrx/core` exposes a full public API** — `parseModule` (→ ESTree AST), `createJsxTransform(platform)` (the extension point all five targets use), CSS pipeline, and AST utilities. The `JsxPlatform` descriptor's `hooks` object (`componentToFunction`, `transformElement`, `injectImports`, `controlFlow`) is the codegen extension mechanism. See R1 for details.

---

## Proposed Architecture

### Semantic split in a Le Truc `.tsrx` component body

TSRX mixes JSX statements and TypeScript statements freely in a component body. The Le Truc target reinterprets this as two distinct execution contexts:

```
component ModuleTodo() {
  // ── HTML SECTION ──────────────────────────────────────────────
  // JSX statements → compiled to static HTML artifact at build time
  // TSRX control flow (if, for, switch) allowed here for data-driven HTML
  <ol data-container></ol>
  <template>...</template>

  // ── FACTORY SECTION ───────────────────────────────────────────
  // Non-JSX TypeScript → compiled into defineComponent() factory body
  // Runs in the browser at custom element connect time
  const form = first('form')
  return [watch(...), pass(...)]

  // ── STYLES ────────────────────────────────────────────────────
  <style>/* ... */</style>
}
```

The two-pass compiler:

**Pass 1 — HTML** (build time, Bun): Executes the component body with JSX statements active, TypeScript stubs returning sensible defaults. Serializes the JSX output to an HTML string, wrapped in the custom element tag.

**Pass 2 — JS** (build time, Bun): Collects all non-JSX TypeScript statements and wraps them in `defineComponent('custom-element-name', (ctx) => { ... return [...] })`. Le Truc's factory context helpers (`first`, `all`, `watch`, `pass`, `on`, `expose`, `each`) are in scope.

**Pass 3 — CSS**: Identical to existing TSRX CSS extraction. Scoping strategy: use the custom element tag as prefix (e.g., `module-todo .btn { }`) rather than hash-based class scoping (see R6).

### Custom element name convention

TSRX uses PascalCase component names. Le Truc requires kebab-case custom element names. The target converts automatically:

- `ModuleTodo` → `module-todo`
- `BasicButton` → `basic-button`
- `FormTextbox` → `form-textbox`

Override via JSDoc annotation if needed:
```ts
/** @custom-element my-special-name */
component MySpecialName() { ... }
```

### Composability

When component A's template contains `<ComponentB />` (a TSRX import), the compiler inlines B's HTML at build time. This is template composition that is impossible today with separate `.html` files. Each custom element's Le Truc factory remains independently registered — composability is an HTML authoring concern, not a runtime signal-sharing concern. Runtime signal sharing still uses `pass()` and context as usual.

Composability requires an **inside-out compilation pass**: leaf components are compiled first; their HTML is resolved and available when parent components are compiled. This dependency-resolution pass is integral to the proof of concept, not a post-v1 addition (see R5).

---

## Todo Example Mapping

Below is `module-todo.tsrx` — conceptually equivalent to the current three-file layout (`module-todo.ts` + `module-todo.html` + `module-todo.css`).

### HTML section

The JSX defines the full component structure. Two list patterns coexist here (see R4):
- The filter radio group uses a TSRX `for` loop — its options are build-time-known config.
- The todo item list uses a `<template>` element — items are added at runtime by `createList` and the compiler must preserve `<template>` as-is, not iterate it.

```tsrx
// Compiles to static HTML wrapping the output in <module-todo filter="all">...</module-todo>
<form action="#">
  <form-textbox clearable>
    <label for="add-todo">What needs to be done?</label>
    <div class="input">
      <input id="add-todo" type="text" value="" />
      <button type="button" class="clear" aria-label="Clear input" hidden>✕</button>
    </div>
  </form-textbox>
  <basic-button class="submit">
    <button type="submit" class="constructive" disabled>
      <span class="label">Add Todo</span>
    </button>
  </basic-button>
</form>
<span role="status" class="visually-hidden"></span>
<ol data-container></ol>
<template>
  <li>
    <button type="button" class="reorder" aria-label="Drag to reorder" aria-pressed="false">≡</button>
    <form-checkbox class="todo">
      <input type="checkbox" class="visually-hidden" />
      <form-inplace-edit>
        <label class="label text"><slot></slot></label>
        <button type="button" aria-label="Edit">✎</button>
      </form-inplace-edit>
    </form-checkbox>
    <basic-button class="remove">
      <button type="button" class="tertiary destructive small" aria-label="Remove">
        <span class="label">✕</span>
      </button>
    </basic-button>
  </li>
</template>
<footer>
  <basic-pluralize>
    <p class="none">Well done, all done!</p>
    <p class="some">
      <span class="count"></span><span class="one"> task</span><span class="other"> tasks</span> remaining
    </p>
  </basic-pluralize>
  <form-radiogroup value="all" class="split-button">
    <fieldset>
      <legend class="visually-hidden">Filter</legend>
      <label class="selected">
        <input type="radio" class="visually-hidden" name="filter" value="all" checked />
        <span>All</span>
      </label>
      <label>
        <input type="radio" class="visually-hidden" name="filter" value="active" />
        <span>Active</span>
      </label>
      <label>
        <input type="radio" class="visually-hidden" name="filter" value="completed" />
        <span>Completed</span>
      </label>
    </fieldset>
  </form-radiogroup>
  <basic-button class="clear-completed">
    <button type="button" class="tertiary destructive">
      <span class="label">Clear Completed</span>
      <span class="badge"></span>
    </button>
  </basic-button>
</footer>
```

### Factory section

Identical to the current `module-todo.ts` factory body — the Le Truc API is unchanged. The factory section is what `defineComponent('module-todo', ...)` wraps at compile time.

```ts
const form = first('form', 'Add a form element to enter a new todo item.')
const textbox = first('form-textbox', 'Add <form-textbox> component to enter a new todo item.')
const submit = first('basic-button.submit', 'Add <basic-button.submit> component to submit the form.')
const container = first('[data-container]', 'Add a container element for items.')
// ... (full factory body per current module-todo.ts)

return [
  pass(submit, { disabled: () => !textbox.length }),
  pass(count, { count: () => activeCount.get() }),
  // ...
]
```

### Style section

```tsrx
<style>
  /* Contents of current module-todo.css, unchanged */
</style>
```

### Compilation output

```
examples/module/todo/module-todo.tsrx
  → dist/module-todo.html       (HTML artifact — embed in page)
  → dist/module-todo.js         (defineComponent() call — bundle for browser)
  → dist/module-todo.css        (extracted and scoped styles)
```

---

## Risks and Concept Mismatches

### R1 — Custom target API in `@tsrx/core` ✓ RESOLVED

Source audit of `github.com/Ripple-TS/ripple` confirms a rich public API. No fork required.

#### Public API surface (`packages/tsrx/src/index.js`)

| Export | Purpose |
|---|---|
| `parseModule(source, filename, options?)` | Parses `.tsrx` source → ESTree-compatible AST |
| `createJsxTransform(platform)` | Returns a `transform(ast, source, filename, options?)` function; used by all five existing targets |
| `createScopes(ast)` | Scope / binding analysis |
| `parseStyle`, `analyzeCss`, `renderStylesheets` | Full CSS pipeline |
| `isComponentNode`, `isFunctionNode`, `getComponentFromPath`, `extractIdentifiers`, `builders`, … | AST classification and manipulation utilities |
| `isVoidElement`, `isBooleanAttribute`, `isDomProperty`, `validateNesting` | HTML helpers |

#### `createJsxTransform(platform)` — the extension point

Every existing target (React, Preact, Solid, Vue, Ripple) is implemented as a `JsxPlatform` descriptor passed to `createJsxTransform`. The descriptor controls:

```js
{
  name: string,
  imports: { suspense: string },
  jsx: { rewriteClassAttr: boolean },
  validation: { requireUseServerForAwait: boolean, … },
  hooks: {
    initialState?:             () => object,
    componentToFunction?:      (component, context, helperState) => FunctionDeclaration,
    transformElement?:         (element, state, rawChildren) => JSXElement,
    isTopLevelSetupCall?:      (node, context) => boolean,
    injectImports?:            (program, context, suspenseSource) => void,
    validateComponentAwait?:   (expr, component, state, …) => void,
    controlFlow?: { forOf?: boolean },
  }
}
```

`createJsxTransform(platform)` returns `transform(ast, source, filename?, options?)` → `{ code, map, css }`.

#### How a Le Truc target uses this API

The three compilation passes map onto `@tsrx/core` APIs as follows:

**JS pass** — uses `createJsxTransform` with a `le_truc_platform` descriptor:
- `componentToFunction` emits `defineComponent('tag-name', (ctx) => { … })` instead of a React function component. The factory body is the non-JSX TypeScript statements from the component body.
- `transformElement` suppresses JSX-to-`createElement` conversion; JSX elements in the body are excluded from the JS output (they belong to the HTML pass only).
- `injectImports` injects the Le Truc factory context imports.
- `controlFlow.forOf: false` disables Solid/Ripple-style `for` lowering (not needed).

**HTML pass** — does not use `createJsxTransform`; uses `parseModule` + a custom AST walker:
- Walk the `Component` body, collect JSX element nodes.
- Convert JSX nodes to Preact `h()` calls (respecting `<template>` pass-through and TSRX `for` iteration).
- Run `preact-render-to-string`'s `renderToStaticMarkup` in Bun.
- Wrap output in the custom element's outer tag.

**CSS pass** — uses `parseStyle` / `analyzeCss` / `renderStylesheets` from `@tsrx/core` directly, with custom-element-scoped class wrapping instead of hash scoping.

#### Bun plugin pattern (from `bun-plugin-react`)

```
onLoad(.tsrx) →
  compile(source, path) [= parseModule() + transform()] →
  { code, css } →
  CSS stored in virtual module cache (Map) →
  import injected for CSS virtual module →
  JS output returned with loader: 'js' | 'tsx'
```

The Le Truc Bun plugin registers the same two-loader structure plus a third HTML output written to disk (or returned as a virtual module for embedding).

### R2 — Server/client interpolation boundary is not yet defined △ MEDIUM (PoC-driven)
The HTML pass and the JS pass operate on the same component body. Determining which statements belong to which pass is non-trivial when code is interleaved. A statement like `const count = items.length` could be build-time (used in an `if` driving conditional HTML) or runtime (a Le Truc reactive value in the factory).

**Approach**: The boundary will be defined through proof-of-concept iteration rather than up-front specification. The PoC will explore real component authoring patterns to discover where the natural seam falls — and whether an explicit marker (e.g., a `factory {}` block, a `// @factory` comment, or relying on Le Truc API references as the signal) produces the best authoring experience. The final split rule will be documented once the PoC demonstrates it in practice.

### R3 — Static HTML generation is not in TSRX ✓ RESOLVED
All existing TSRX targets produce runtime JS, not static HTML. The Le Truc target needs a static renderer for the HTML pass, running inside Bun (no DOM APIs available).

**Decision**: Use **Preact's `renderToStaticMarkup`** as the HTML renderer. Build-time dependency only — not shipped to browsers. Factory-section code must be excluded from this pass; the compiler must guarantee the separation.

### R4 — `<template>` element and TSRX `for` loop coexist ✓ RESOLVED
Both patterns are needed and serve distinct purposes:

- **TSRX `for ... of`** → renders build-time-known children into the static HTML output. Use for lists whose items are fixed at compile time (e.g., navigation items from config, radio group options, tab headers).
- **HTML `<template>` element** → preserved as-is in the HTML output; serves as the structural blueprint for `createList` to clone at runtime. Use for lists whose items are added, removed, or reordered by the user.

The compiler must distinguish these two: `<template>` JSX elements are passed through to the HTML artifact without iteration. TSRX `for` loops outside `<template>` are executed eagerly during the HTML pass.

The todo example uses both: the filter radio group (`for` over `['all', 'active', 'completed']`) and the todo item list (`<template>` for `createList` runtime management).

### R5 — Composability requires inside-out compilation ⚠️ MEDIUM (integral to PoC)
When component A's template contains `<ComponentB />` (a TSRX import), the HTML pass must inline B's HTML inside the `<component-b>` custom element tag. The child's Le Truc factory remains independently registered — composability is HTML inlining only; `pass()` remains the runtime signal-sharing mechanism.

This requires an **inside-out compilation pass**: leaf components (no TSRX component children) must be compiled first; their resolved HTML is available when their parents are compiled. The compiler builds a dependency graph and processes components in topological order.

This is not a post-v1 addition — it is an integral part of the proof of concept. Without it, the value of co-location is significantly diminished (parent components still need manual HTML for their children). The PoC must demonstrate that `<FormTextbox />` in a parent template resolves to inlined child HTML in the output.

**Open shape**: What happens when a child component's props affect its HTML structure (e.g., a `<Button variant="primary" />`)?  The HTML pass would need to resolve those props at build time. The PoC will explore how much static prop passing is useful vs. where runtime `pass()` takes over.

### R6 — CSS scoping model △ LOW
TSRX uses hash-based CSS class scoping (modifies class names in both HTML and CSS output). Le Truc components scope their CSS naturally via the custom element tag selector. Hash-based scoping would modify class names in the HTML output, and the factory code's `first()` / `all()` selectors would need to match the hashed names — breaking the clean relationship between factory queries and HTML structure.

**Mitigation**: Disable TSRX hash scoping for the Le Truc target. Wrap all CSS rules in the custom element tag selector (`module-todo { ... }`) or use `:host` for Shadow DOM consumers. This is a first-class departure from TSRX's default behavior.

### R7 — Server-side data binding is out of scope △ LOW
TSRX components receive props at render time. In a Le Truc TSRX workflow, the HTML pass runs at build time — no request-time data. For truly static HTML (navigation, layout, always-the-same structure), this is fine. For components where initial HTML must reflect server data (e.g., an initial list of todos loaded from a database), the static HTML output is a structural template with empty/placeholder state only. Data hydration must happen via Le Truc parsers reading attributes at connect time, not via the TSRX HTML pass.

This is not a new constraint — it matches Le Truc's existing model. But it means TSRX does not replace server-side templating (Nunjucks, Twig, Thymeleaf) for data-driven initial states. It coexists with it: TSRX generates the structural HTML, the CMS/server fills in the data, Le Truc enhances the result.

**Mitigation**: Document the layering clearly. TSRX is responsible for structure; the server templating layer is responsible for initial data. This is the same contract Le Truc has always had with its host environments.

### R8 — IDE / TypeScript cross-section type inference △ LOW
In the Le Truc TSRX target, the factory section calls `first('form-textbox')` and the HTML section contains `<form-textbox>`. The compiler could infer that `first('form-textbox')` returns the type declared in the `HTMLElementTagNameMap` for `form-textbox` because it appears in the HTML section — giving end-to-end type safety from template to factory. This is a potential ergonomic win over the current three-file approach.

However, implementing cross-section type inference is non-trivial and depends on how `@tsrx/core` exposes the AST.

**Mitigation**: v1 ships with no cross-section inference — factory types work identically to today. Type inference enhancement is a future milestone.

---

## Phased Implementation

### Phase 0 — `@tsrx/core` audit ✓ COMPLETE
`@tsrx/core` exposes `parseModule` (→ ESTree AST), `createJsxTransform(platform)` (target extension point), and a full CSS + AST utility suite. No fork required. **Decision: build on `@tsrx/core`'s public API.**

### Phase 1 — Proof of concept (single nested component)
The PoC targets `module-todo` and at least one of its child components (e.g., `basic-button` or `form-textbox`) to exercise all three core mechanics together:

1. **Leaf component**: compile `basic-button.tsrx` → HTML + JS + CSS (establishes the single-component pipeline)
2. **Inside-out pass**: compile `module-todo.tsrx` with `<BasicButton />` resolving to inlined child HTML (establishes the composability dependency graph)
3. **Body split experimentation**: try at least two split strategies (Le Truc API-reference heuristic vs. explicit marker) and evaluate authoring ergonomics
4. **`<template>` + `for` coexistence**: the todo's filter options use a TSRX `for`; its item list uses `<template>` — the PoC must handle both in one file
5. **Playwright smoke test**: run the existing `module-todo.spec.ts` against PoC-compiled output

The PoC is complete when the todo example compiles and its tests pass. The body-split rule is documented based on what the PoC reveals.

### Phase 2 — Harden and expand
1. CSS loader: extract `<style>` block → apply custom-element-scoped wrapping → emit `.css` file
2. Component name → kebab-case convention with `@custom-element` override
3. Port remaining example components to validate the authoring model at scale
4. Document the authoring model and constraints in a `TSRX-GUIDE.md`

---

## Open Questions

1. ~~**`@tsrx/core` extension API**~~ ✓ Resolved — `parseModule` + `createJsxTransform(platform)` + CSS/AST utilities are all public. Build on `@tsrx/core`. See R1.

2. **Body split rule** *(PoC outcome)* — Which marker produces the best authoring experience: Le Truc API-reference heuristic, an explicit `factory {}` block, a `// @factory` comment boundary, or something else? To be settled by PoC iteration.

3. **Static props in child component composition** — When a parent uses `<BasicButton variant="primary" />`, should the HTML pass resolve `variant` into the child's HTML output at build time? Where does static prop resolution end and runtime `pass()` begin? Sharpest question for the inside-out PoC.

4. **Build output structure** — Should the HTML artifact be a full HTML document, an inner-HTML fragment, or the custom element's outer HTML (e.g., `<module-todo filter="all">...</module-todo>`)? The outer-HTML form seems most useful for embedding, but needs validation against real CMS integration patterns.

5. **CSS scoping** — Wrap all rules in `custom-element-name { }` (simple, light DOM), or use `:host { }` (Shadow DOM compatible)? Or leave unscoped?

6. **Package boundary** — Does the TSRX plugin live in this repo (`packages/bun-plugin-le-truc/` workspace) or as a separate npm package? In-repo is simpler to start; separate package is cleaner long-term.
