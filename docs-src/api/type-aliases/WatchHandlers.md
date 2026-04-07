### Type Alias: WatchHandlers\<T\>

> **WatchHandlers**\<`T`\> = `object`

Defined in: [src/effects.ts:47](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L47)

User-facing handler object for `watch()` with match branches.
`ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
`err` receives a single Error (not an array) for convenience.

#### Type Parameters

##### T

`T`

#### Properties

##### err?

> `optional` **err?**: (`error`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:49](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L49)

###### Parameters

##### error

`Error`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### nil?

> `optional` **nil?**: () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:50](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L50)

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### ok

> **ok**: (`value`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:48](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L48)

###### Parameters

##### value

`T`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)
