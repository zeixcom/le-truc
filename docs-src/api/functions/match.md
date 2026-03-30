### Function: match()

> **match**\<`T`\>(`signals`, `handlers`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:59

Reads one or more signals and dispatches to the appropriate handler based on their state.
Must be called within an active owner (effect or scope) so async cleanup can be registered.

#### Type Parameters

##### T

`T` *extends* readonly [`Signal`](../type-aliases/Signal.md)\<\{ \}\>[]

#### Parameters

##### signals

readonly \[`T`\]

Tuple of signals to read; all must have a value for `ok` to run.

##### handlers

[`MatchHandlers`](../type-aliases/MatchHandlers.md)\<`T`\>

Object with an `ok` branch and optional `err` and `nil` branches.

#### Returns

[`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

An optional cleanup function if the active handler returns one.

#### Since

0.15.0

#### Throws

RequiredOwnerError If called without an active owner.
