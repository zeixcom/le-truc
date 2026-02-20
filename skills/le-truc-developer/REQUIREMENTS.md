# Requirements: Le Truc Developer Skill

**For:** Solution Architect
**Goal:** Produce 2–3 distinct skill variants that make a Claude Code agent expert at writing Le Truc web components. After testing, variants will be refined until the produced artifacts are satisfactory.

---

## 1. Purpose and Scope

The skill equips a Claude Code agent to:

1. **Look up** the Le Truc API accurately (source files or Context7, depending on available tooling and user preference).
2. **Apply** a clear mental model of how Le Truc's primitives fit together.
3. **Decompose** frontend behavior into focused, reusable components — one concern per component.
4. **Compose** those components into applications without coupling them to their context.

The primary user of the skill is Claude Code. Prompts from end-users may range from short ("Write a stylable custom select dropdown") to detailed (full feature specs with third-party library constraints).

---

## 2. API Access Strategy

### 2.1 Source-first lookup

The canonical API lives in this repository under `src/`. The agent may read source files directly. Key files and their roles:

| File | Exports |
|---|---|
| `src/component.ts` | `defineComponent` — the single entry point for defining a component |
| `src/ui.ts` | `getHelpers`, `createElementsMemo`, UI query types (`first`, `all`) |
| `src/effects.ts` | `runEffects`, `updateElement`, `Reactive`, `Effects` types |
| `src/effects/event.ts` | `on` — event listener effect |
| `src/effects/attribute.ts` | `setAttribute`, `toggleAttribute` |
| `src/effects/class.ts` | `toggleClass` |
| `src/effects/text.ts` | `setText` |
| `src/effects/style.ts` | `setStyle` |
| `src/effects/property.ts` | `setProperty` |
| `src/effects/html.ts` | `dangerouslySetInnerHTML` |
| `src/effects/pass.ts` | `pass` — passes reactive values to child Le Truc components |
| `src/context.ts` | `provideContexts`, `requestContext`, `ContextRequestEvent` |
| `src/parsers.ts` | `Parser`, `Reader`, `read`, `isParser` |
| `src/parsers/string.ts` | `asString` |
| `src/parsers/number.ts` | `asNumber`, `asInteger` |
| `src/parsers/boolean.ts` | `asBoolean` |
| `src/parsers/json.ts` | `asJSON` |

### 2.2 Context7 fallback

If the user prefers or the agent cannot read source files directly, Context7 should be used to retrieve up-to-date documentation. The agent must call `resolve-library-id` before `query-docs`. Library name: `le-truc` or `@zeixcom/le-truc`.

### 2.3 Embedded core knowledge

The API surface is frozen (pre-1.0 feature freeze). The skill prompt **must embed** the core mental model and the complete list of built-in effects, parsers, and coordination mechanisms so the agent does not need to look them up for every task. Source lookups should be reserved for details, edge cases, and third-party library integration.

---

## 3. Mental Model the Agent Must Hold

### 3.1 Component anatomy

Every Le Truc component is defined by four arguments to `defineComponent`:

```
name       → valid custom element name (lowercase, contains hyphen)
props      → signals: static values | Signal | Parser | Reader | MethodProducer
select     → UI map: { key: first(selector) | all(selector) }
setup      → effects map: { key: Effect | Effect[] }
```

The `ui` object passed to `setup` contains all selected elements plus `host` (the component element itself). The `host` is the only bridge between the component's reactive state and the outside world.

### 3.2 Reactivity flow

```
attribute change
      ↓
Parser → host.prop (State signal)
      ↓
Effect reads host.prop → updates target DOM element
      ↓
Event handler returns { prop: value } → State signal updated → Effect re-runs
```

### 3.3 Coordination: when to use what

| Scenario | Mechanism |
|---|---|
| Parent controls known child component | `pass()` effect — replaces child's Slot signal |
| Child needs data owned by a distant ancestor | `requestContext` / `provideContexts` |
| Sibling-to-sibling communication | **Not permitted.** Lift state to a shared ancestor. |
| Component reacts to DOM events from children | `on()` effect on `host` (event bubbling) |
| Dynamic list of children | `all(selector)` memo — effects run per-element reactively |

### 3.4 Decomposition rules

Group what belongs together **from the user's semantic perspective**:

- A form field = `<label>` + control(s) + hint + error message → one component
- A list = heading + `<ol>`/`<ul>`/`<dl>` + items → one component per level (list and item contents are separate components)
- A card = all elements that form one repeated unit → one component
- A data visualisation = title + chart area + caption + tooltip → one component (the chart library integration lives here)
- A context wrapper (e.g. a server-sync scope) → one component that provides context to descendants

**Split** when:
- Two pieces of state have no data-flow or structural relationship.
- An element is reused independently in other locations.
- A sub-element is itself a natural unit (e.g. a list item inside a list).

**Do not split** arbitrarily. Three related states in one component are better than three one-state components with coupling logic to compensate.

---

## 4. Anti-Patterns the Agent Must Avoid

| Anti-pattern | Why |
|---|---|
| Assuming outer context (parent, siblings, global) | Breaks composability; components must be self-contained except for explicit `requestContext` calls |
| Direct manipulation of inner elements of child components | Violates encapsulation; use `pass()` instead |
| Querying outside `host` (e.g. `document.querySelector`) | Components must stay scoped to their subtree |
| Sibling communication via shared mutable state or events that bypass the DOM hierarchy | Creates hidden coupling; lift state to an ancestor instead |
| Packing unrelated state into one component | Hard to reason about, hard to reuse; split on data-flow independence |
| Overusing `dangerouslySetInnerHTML` | Security risk; use only for explicitly trusted, sanitized content |
| Skipping TypeScript types on `props` and `select` | Loses the type safety that parsers and UI queries provide |
| Using `all()` when only one element is expected | Use `first()` for single elements |
| Forgetting to return cleanup from custom effects | Memory leaks on disconnection |

---

## 5. Skill Variants

The Solution Architect shall implement **three clearly differentiated variants**. The differentiation axes are:

### Axis A: Knowledge delivery (embedded vs. dynamic)
- **Embedded**: The skill prompt contains the full API reference inline. The agent rarely needs to read source files.
- **Dynamic**: The skill prompt contains only the mental model and rules. The agent is instructed to look up the API before starting.

### Axis B: Instruction style (prescriptive vs. exploratory)
- **Prescriptive**: The skill prompt gives explicit step-by-step rules for decomposition, effect selection, and coordination. The agent follows a defined process.
- **Exploratory**: The skill prompt defines goals and anti-patterns but gives the agent freedom to reason about structure. It trusts the agent's judgment.

### Axis C: Planning gate (plan-first vs. code-first)
- **Plan-first**: The agent must produce a written component breakdown (names, props, effects, coordination) before writing any code. The plan is shown to the user.
- **Code-first**: The agent proceeds directly to implementation.

### Variant matrix

| Variant | Knowledge | Instructions | Planning |
|---|---|---|---|
| **V1** | Embedded | Prescriptive | Plan-first |
| **V2** | Dynamic | Exploratory | Code-first |
| **V3** | Embedded | Exploratory | Plan-first |

Variants V1 and V2 are the most clearly differentiated and should be implemented first. V3 is the tie-breaker, combining the fast API access of V1 with the agent freedom of V2.

---

## 6. Evaluation Scale

Human reviewers score each generated artifact on six dimensions. Each dimension is scored **1–5**.

### 6.1 Dimensions

#### Correctness (weight: high)
Does the code run? Does it use the Le Truc API correctly (right arguments, right types, right lifecycle)?

| Score | Description |
|---|---|
| 1 | Does not run; API used incorrectly throughout |
| 2 | Runs with errors; several API misuses |
| 3 | Runs; minor API misuses or type errors |
| 4 | Runs correctly; API used as intended |
| 5 | Runs correctly; edge cases handled; TypeScript types fully correct |

#### Composability (weight: high)
Can the components be reused and recombined without modification? Are coordination mechanisms context-agnostic?

| Score | Description |
|---|---|
| 1 | Components are tightly coupled to one specific context |
| 2 | Components assume specific parent or sibling structure |
| 3 | Components are mostly self-contained but have some implicit dependencies |
| 4 | Components are self-contained; coordination via `pass()` or `requestContext` |
| 5 | Components are freely composable; can be placed anywhere in the DOM tree without changes |

#### Code Readability (weight: high)
Is the code easy to follow? Is the decomposition obvious? Are names clear?

| Score | Description |
|---|---|
| 1 | Hard to follow; unclear structure and naming |
| 2 | Partially readable; some confusing patterns |
| 3 | Readable; a few unclear choices |
| 4 | Clear structure, good naming, easy to follow |
| 5 | Exemplary clarity; another developer could maintain it immediately |

#### Separation of Concerns
Does each component have one clear job? Is unrelated state split across components?

| Score | Description |
|---|---|
| 1 | Multiple unrelated concerns packed into one component |
| 2 | Some mixing of concerns; unclear responsibilities |
| 3 | Mostly separated; one or two avoidable overlaps |
| 4 | Each component has a clear, single responsibility |
| 5 | Decomposition is exactly right; no over- or under-splitting |

#### Idiomatic Le Truc Usage
Does the code use the right Le Truc primitives for each situation?

| Score | Description |
|---|---|
| 1 | Wrong primitives used; misunderstands the reactive model |
| 2 | Partially idiomatic; workarounds where built-ins would suffice |
| 3 | Mostly idiomatic; occasional suboptimal choices |
| 4 | Idiomatic throughout; uses parsers, effects, and context correctly |
| 5 | Idiomatic and elegant; demonstrates mastery of the signal model |

#### Type Safety
Are TypeScript types used correctly and completely, especially for `props`, `select`, and effects?

| Score | Description |
|---|---|
| 1 | Types absent or systematically wrong |
| 2 | Partial types; `any` used where unnecessary |
| 3 | Acceptable types; minor gaps |
| 4 | Full types on all component boundaries |
| 5 | Types are precise; generic parameters used correctly; no unnecessary `any` |

#### Accessibility
Are components keyboard-navigable? Are ARIA roles, states, and properties used correctly?

| Score | Description |
|---|---|
| 1 | No accessibility consideration |
| 2 | Minimal; missing essential ARIA or keyboard support |
| 3 | Basic accessibility; some gaps |
| 4 | ARIA and keyboard interactions correct for the component type |
| 5 | Full accessibility; follows ARIA Authoring Practices Guide for the pattern |

### 6.2 Scoring summary

For each artifact, record:

```
Variant:       V1 / V2 / V3
Task prompt:   [the user's original prompt]

Correctness:        _ / 5
Composability:      _ / 5
Code Readability:   _ / 5
Separation:         _ / 5
Idiomatic usage:    _ / 5
Type Safety:        _ / 5
Accessibility:      _ / 5

Notes:
[Freeform observations about what worked, what did not, and specific failures]
```

### 6.3 Benchmark tasks

Use the following tasks when comparing variants. They range from short to detailed:

1. **Short / open-ended**: "Write a stylable custom select dropdown."
2. **Medium / structural**: "Write a filterable, sortable data table with pagination. Each cell content may be a sub-component."
3. **Long / third-party**: "Write a data visualisation component that displays data as column, line, bar, or doughnut chart (configurable via `type` attribute). Include a title, caption, and configurable x/y axis labels with units. Show a tooltip on hover. Implement using Chart.js."
4. **Context coordination**: "Write a form with three fields (text input, select, checkbox). Wrap them in a form controller component that validates on submit and shows a success or error state."

---

## 7. Constraints for the Solution Architect

- Each variant **must** be a standalone skill file (e.g. `SKILL-V1.md`, `SKILL-V2.md`, `SKILL-V3.md`) in `skills/le-truc-developer/`.
- The skill prompt must be written for Claude Code specifically: it will be injected as a system-level context before the user's task prompt.
- Do not include example code longer than ~30 lines inline in the skill prompt — link or reference source files instead for longer examples.
- Embedded API reference must be accurate to the frozen 0.16 API as found in `src/`. Do not invent or speculate about the API.
- Each variant must explicitly state which axes it represents at the top of the file (e.g. `Knowledge: Embedded | Instructions: Prescriptive | Planning: Plan-first`).
- All three variants must cover: decomposition rules, coordination mechanisms, anti-patterns, and how to look up the API. They differ in *how* they cover these, not *whether*.
