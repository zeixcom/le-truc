# API DX Review — v1.1 Factory API

## Scope

This review evaluates the developer experience of the `defineComponent` v1.1 factory API, based on the current TypeScript examples and comparison with the v1.0 4-parameter API.

It focuses on:

- the overall ergonomics of the new 2-parameter form
- how the new factory-context helpers read in real component code
- whether the current helper names are clear
- practical improvements worth making before the v1.1 API is finalized

## Executive summary

The v1.1 API is a meaningful DX improvement overall.

The main win is **locality**: querying elements, exposing host API, creating local state, and wiring reactive behavior now live in a single closure. That makes components easier to read, easier to refactor, and easier to hold in your head while editing.

The main cost is that some simple DOM-binding patterns are now a bit more manual than they were in v1.0, especially where the old API could lean on compact effect helpers and keyed effect maps.

### High-level recommendation

- Keep the v1.1 2-parameter `defineComponent(name, factory)` form as the primary API.
- Rename `run` to `watch`.
- Keep `each`.
- Keep the existing v1.0-aligned names for `host`, `first`, `all`, `on`, `pass`, `provideContexts`, and `requestContext` unless semantics change.
- For `expose`, either:
  - keep `expose` for brevity, or
  - rename it to `exposeAPI` if additional explicitness is desired before the API is stabilized.

If `expose` is renamed, `exposeAPI` is the strongest option among the alternatives discussed.

---

## Findings from the examples

### 1. The v1.1 factory form improves locality and flow

In v1.0, the common mental model was split across multiple phases:

1. declare props
2. declare UI shape
3. return effects keyed by UI entries

That structure was workable, but it forced the author to bounce between:

- prop initializers
- UI types
- selectors
- effect maps
- host-specific keyed effects

In v1.1, the code usually reads as one linear behavior story:

1. query what you need
2. derive local state/memos
3. expose the host-facing API
4. return reactive effect descriptors

This is easier to author and easier to maintain.

### 2. The improvement is strongest for medium and complex components

The clearest wins are components that coordinate several descendants or several behaviors at once.

Examples such as:

- `module-catalog`
- `module-listnav`
- `form-combobox`

benefit noticeably from the v1.1 shape because the code can stay in one closure without carrying a separate `UI` type and separate setup phases.

These components read more like behavior and less like framework configuration.

### 3. Very small “binding-only” components are more mixed

For simple components whose main job is to map reactive props to DOM updates, v1.0 sometimes felt more concise.

The old API could be pleasantly declarative because it allowed patterns like:

- compact prop definitions
- compact UI queries
- compact element-keyed effect maps
- reusable helpers for text/property/class binding

In v1.1, the same behavior is usually still straightforward, but it may take a few more inline lambdas.

That is not a regression in conceptual clarity, but it is sometimes a regression in terseness.

### 4. The new API is better as maintainable code, even when not shorter

The strongest overall conclusion from the examples is:

- v1.0 was often more declarative as framework configuration
- v1.1 is better as code you actually maintain

That is a worthwhile trade for this library.

---

## What got better in v1.1

### Reduced ceremony

Common v1.0 overhead that often disappears in v1.1:

- extra `UI` type declarations
- separate UI factory functions
- separate setup/effects factory functions
- keyed effect records when a simple returned array is enough

This is especially valuable in orchestration-heavy examples.

### Better refactorability

In v1.0, changing one queried element or one prop often meant updating several disconnected places.

In v1.1, most changes stay local to the factory closure.

That is a real DX improvement.

### Better top-to-bottom readability

The v1.1 examples generally read in the order that a developer reasons about the component:

- find elements
- compute state
- expose host API
- wire effects/events/context

That aligns well with the intended architecture.

### Better conceptual fit with the v1.1 architecture

The current helper set gives the factory form a strong internal consistency:

- queries: `first`, `all`
- host API declaration: `expose`
- reactive effects: `run`
- per-element effects: `each`
- events: `on`
- child-component updates: `pass`
- context: `provideContexts`, `requestContext`

This is a cleaner mental model than the old split phases.

---

## What is still rough

### Simple DOM sync is sometimes noisier than necessary

For straightforward patterns like:

- set text
- set property
- toggle class
- show/hide
- set/remove attribute

v1.1 currently asks authors to write more small handlers than v1.0 often required.

This is not a reason to revert the API shape, but it is a reason to provide a few convenience helpers around the new model.

### Method exposure still deserves smoothing

The method story is one of the places where the API still feels slightly under-designed.

The host-facing API is conceptually strong, but the ergonomics for exposing methods should feel as natural as exposing values.

That is one reason `defineProps` is not a great name: the helper does more than define props.

### One old-style fixture can muddy the examples story

If any intentionally legacy examples or test fixtures still use the old style, they should be clearly marked as such so they do not weaken the public narrative of the v1.1 API.

---

## Helper naming review

### Naming principles used for this review

The naming assessment is based on the following criteria:

- Can a new user understand the helper from examples alone?
- Does the name reflect the helper’s real semantics?
- Does it preserve familiarity where there is already prior art in v1.0?
- Is it short enough to use frequently without friction?
- Does it compose well with the rest of the helper set?

### Summary table

| Helper | Current clarity | Recommendation | Notes |
| --- | --- | --- | --- |
| `host` | Strong | Keep | Familiar and accurate |
| `first` | Strong | Keep | Short, query-oriented, already established |
| `all` | Strong | Keep | Pairs well with `first` and `each` |
| `on` | Strong | Keep | Familiar event helper, already established |
| `pass` | Good | Keep | Domain-specific but already known in the API |
| `provideContexts` | Good | Keep | Preserve compatibility unless semantics change |
| `requestContext` | Strong | Keep | Familiar and explicit |
| `each` | Strong | Keep | Best available name for the behavior |
| `run` | Weak | Rename to `watch` | The weakest current name |
| `expose` | Medium-good | Keep or rename to `exposeAPI` | Depends on how explicit the final API should be |

---

## `host`

### Assessment
Clear and established.

### Recommendation
Keep.

### Reasoning
`host` is short, conventional, and accurately describes the component element itself. There is no compelling reason to rename it.

---

## `first` and `all`

### Assessment
Clear and well-matched to usage.

### Recommendation
Keep.

### Reasoning
These names are short, query-oriented, and read naturally in the factory closure. They also pair very well with `each`, which makes the query/effect story easy to follow.

Examples like the following are easy to understand at a glance:

- get one thing with `first(...)`
- get many things with `all(...)`
- attach per-element behavior with `each(...)`

That is a strong little language.

---

## `on`

### Assessment
Clear and already familiar.

### Recommendation
Keep.

### Reasoning
`on(...)` is already conventional and matches its effect-oriented purpose well. There is little to gain by renaming it.

---

## `pass`

### Assessment
Good enough and already part of the library vocabulary.

### Recommendation
Keep.

### Reasoning
`pass` is somewhat library-specific, but it already exists in the mental model of Le Truc. Since preserving familiarity is important, this is a good candidate to leave alone.

---

## `provideContexts` and `requestContext`

### Assessment
Clear enough, especially as a pair.

### Recommendation
Keep.

### Reasoning
These names are explicit and already established. They also read well together as a provider/consumer pair.

Unless their behavior changes materially, compatibility and familiarity outweigh the value of further name exploration here.

---

## `each`

### Assessment
Clear and worth keeping.

### Recommendation
Keep.

### Reasoning
`each(items, item => ...)` reads naturally and pairs especially well with `all(...)`.

It communicates iteration over a reactive collection without over-explaining the implementation details. More explicit alternatives like `forEach` or `watchEach` would either sound too eager or too heavy.

Among the available options, `each` is the strongest name.

---

## `run`

### Assessment
Weakest current helper name.

### Recommendation
Rename to `watch`.

### Reasoning
The helper’s semantics are source-driven reactivity:

- watch this prop
- watch this signal
- rerun when the source changes

`run` does not communicate that clearly. It sounds imperative and immediate, which creates avoidable ambiguity:

- run when?
- run once or reactively?
- run now or on changes?
- run because of explicit sources or tracked reads?

`watch` is significantly clearer.

It also has the right familiarity profile:

- already widely understood in reactive UI systems
- especially intuitive for Vue users
- still generic enough to fit Le Truc’s semantics

### Why not `react`
`react` could work semantically, but the association with the React ecosystem is strong enough that it is likely to create distraction rather than clarity.

### Why not `effect`
`effect` would overstate the helper’s behavior. This helper is not “track everything I touch”; it is “react to these explicit sources”. `watch` is more accurate.

### Final recommendation
Rename:

- `run` → `watch`

This is the single naming change with the highest DX payoff.

---

## `expose`

### Assessment
Acceptable, but slightly ambiguous.

### Recommendation
Keep `expose` unless you want more explicitness before API freeze. If renamed, prefer `exposeAPI`.

### Reasoning
`expose` has a real strength: it points at the public host surface rather than just internal state. That matches the architecture well.

However, it is not perfectly self-explanatory on first read.

Potential confusion points:

- in some ecosystems, “expose” suggests an imperative handle, not signal-backed host properties
- it does not explicitly say that values are being declared and initialized
- it is slightly less obvious when used for methods and sensors than for plain values

### Why not `defineProps`
`defineProps` is clearer for plain values, but it becomes misleading once methods are part of the story. The helper is not just defining props in the narrow sense.

### `exposeAPI` vs `defineAPI`
If a rename is desired, `exposeAPI` is the best alternative.

Why `exposeAPI` is stronger than `defineAPI`:

- it preserves the current “expose” mental model
- it makes the public surface explicit
- it still fits values, methods, sensors, and context-backed properties
- it sounds less like component registration than `defineAPI`

### Final recommendation
Two valid options:

#### Option A: keep `expose`
Best if brevity matters more than first-read explicitness.

#### Option B: rename to `exposeAPI`
Best if the API should optimize more strongly for clarity before stabilization.

If a rename happens, prefer:

- `expose` → `exposeAPI`

---

## Final naming recommendation set

### Preferred minimal-change set

- `host`
- `first`
- `all`
- `expose`
- `watch`
- `each`
- `on`
- `pass`
- `provideContexts`
- `requestContext`

This is the best balance of familiarity, clarity, and API elegance.

### Preferred maximum-clarity set

- `host`
- `first`
- `all`
- `exposeAPI`
- `watch`
- `each`
- `on`
- `pass`
- `provideContexts`
- `requestContext`

This is the best version if one more explicit rename is acceptable before v1.1 is finalized.

---

## Recommendations for DX improvements beyond naming

### 1. Stabilize on the 2-parameter factory form as the canonical style

The examples show that the v1.1 form is the right default for future-facing documentation and adoption.

Recommendation:

- make the 2-parameter factory form the canonical API in docs and examples
- keep legacy forms supported, but clearly marked as legacy or transitional

### 2. Rename `run` to `watch`

This is the most important naming improvement.

Recommendation:

- update the helper name
- update examples and docs consistently
- explain that `watch` is source-explicit, not incidental-dependency-driven

### 3. Decide whether `expose` should stay short or become explicit

There is no urgent need to rename `expose`, but if the team wants additional clarity before stabilization, `exposeAPI` is the best alternative discussed so far.

Recommendation:

- keep `expose` if brevity is the goal
- choose `exposeAPI` if clarity is the goal
- avoid `defineProps` because it undersells the method/API use case

### 4. Add a few tiny convenience helpers on top of the v1.1 model

The v1.1 shape is good, but some common effect patterns could be made terser without reintroducing v1.0’s structural complexity.

Good candidates:

- text binding
- property binding
- attribute binding
- class toggle
- hidden/show toggle

Recommendation:

- add small effect-builder helpers that compose with `watch(...)`
- keep them optional and lightweight
- avoid recreating the old keyed effect map structure

### 5. Improve method exposure ergonomics

If methods are part of the host-facing API story, they should feel first-class.

Recommendation:

- review the method initializer ergonomics
- make method exposure feel as straightforward as value exposure
- document one canonical pattern for exposing methods in v1.1

### 6. Write one canonical example per helper

The helper model is compact enough that clear examples will do a lot of DX work.

Recommendation:

- one minimal example for `expose`/`exposeAPI`
- one minimal example for `watch`
- one minimal example for `each`
- one minimal example for `pass`
- one minimal example for context provider/consumer

### 7. Add a short migration guide from v1.0 to v1.1

The ergonomics are better in practice, but the mental model changed enough that a concise migration guide would help.

Recommendation:

- show how a typical 4-parameter component maps to the new factory form
- explain where prop declarations moved
- explain where UI queries moved
- explain how effect maps translate to returned descriptors

---

## Final conclusion

The v1.1 factory API is the right direction.

Its main strength is that it turns component authoring into a single, local, readable unit of code. That is a substantial DX improvement over the v1.0 4-parameter structure, especially for medium and complex components.

The remaining work is mostly polish:

- improve one helper name (`run` → `watch`)
- decide whether `expose` is explicit enough or should become `exposeAPI`
- smooth a few common binding and method-authoring patterns
- ensure the examples present one consistent, canonical story

## Final recommended actions

### Strong recommendation
- rename `run` to `watch`

### Recommended
- keep `each`
- keep the existing v1.0-aligned names for `host`, `first`, `all`, `on`, `pass`, `provideContexts`, and `requestContext`

### Optional but worth deciding before stabilization
- keep `expose`, or rename it to `exposeAPI`
- if renamed, prefer `exposeAPI` over `defineAPI` and `defineProps`

### Nice-to-have follow-up work
- add small convenience effect helpers
- improve method exposure ergonomics
- document canonical helper usage and migration patterns
