### Type Alias: WatchHandlers\<T\>

> **WatchHandlers**\<`T`\> = `object`

Defined in: [src/effects.ts:48](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L48)

User-facing handler object for `watch()` with match branches.
`ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
`err` receives a single Error (not an array) for convenience.

#### Type Parameters

##### T

`T`

#### Properties

##### err?

> `optional` **err?**: (`error`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:50](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L50)

###### Parameters

##### error

`Error`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### nil?

> `optional` **nil?**: () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:51](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L51)

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### ok

> **ok**: (`value`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:49](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L49)

###### Parameters

##### value

`T`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)
