### Function: match()

#### Call Signature

> **match**\<`T`\>(`signal`, `handlers`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:72

Reads one or more signals and dispatches to the appropriate handler based on their state.
Must be called within an active owner (effect or scope) so async cleanup can be registered.

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### signal

[`Signal`](../type-aliases/Signal.md)\<`T`\>

A single signal to read.

###### handlers

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`T`\>

Object with an `ok` branch (receives the value directly) and optional `err` and `nil` branches.

##### Returns

[`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

An optional cleanup function if the active handler returns one.

##### Since

1.1

##### Throws

RequiredOwnerError If called without an active owner.

#### Call Signature

> **match**\<`T`\>(`signals`, `handlers`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:94

Reads one or more signals and dispatches to the appropriate handler based on their state.
Must be called within an active owner (effect or scope) so async cleanup can be registered.

##### Type Parameters

###### T

`T` *extends* readonly [`Signal`](../type-aliases/Signal.md)\<\{ \}\>[]

##### Parameters

###### signals

readonly \[`T`\]

Tuple of signals to read; all must have a value for `ok` to run.

###### handlers

[`MatchHandlers`](../type-aliases/MatchHandlers.md)\<`T`\>

Object with an `ok` branch and optional `err` and `nil` branches.

##### Returns

[`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

An optional cleanup function if the active handler returns one.

##### Since

0.15.0

##### Throws

RequiredOwnerError If called without an active owner.

##### Remarks

**Async handlers are for external side effects only** — DOM mutations, analytics, logging,
or any fire-and-forget API call whose result does not need to drive reactive state.
Do not call `.set()` on a signal inside an async handler: use a `Task` node instead,
which receives an `AbortSignal`, is auto-cancelled on re-run, and integrates cleanly
with `nil` and `err` branches.

Rejections from async handlers are always routed to `err`, including rejections from
stale runs that were already superseded by a newer signal value. The library cannot
cancel external operations it did not start.
