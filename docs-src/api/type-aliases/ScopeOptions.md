### Type Alias: ScopeOptions

> **ScopeOptions** = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:94

Options for configuring scope behavior.

#### Properties

##### root?

> `optional` **root?**: `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:103

When `true`, the scope is not registered on the current parent owner.
The returned `dispose` function becomes the sole mechanism for tearing down the scope.

Use this for scopes with an external lifecycle authority (e.g. a web component
whose `disconnectedCallback` is the teardown point) — without it, a scope created
inside a re-runnable effect would be silently disposed on the next effect re-run.
