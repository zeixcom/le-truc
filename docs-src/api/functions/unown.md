### Function: unown()

> **unown**\<`T`\>(`fn`): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:232

Runs a callback without any active owner.
Any scopes or effects created inside the callback will not be registered as
children of the current active owner (e.g. a re-runnable effect). Use this
when a component or resource manages its own lifecycle independently of the
reactive graph.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T`

The function to execute without an active owner

#### Returns

`T`

The return value of `fn`

#### Since

0.18.5
