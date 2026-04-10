### Type Alias: WatchHandlers\<T\>

> **WatchHandlers**\<`T`\> = `object`

Defined in: [src/effects.ts:51](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L51)

User-facing handler object for `watch()` with match branches.
`ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
`err` receives a single Error (not an array) for convenience.

#### Type Parameters

##### T

`T`

#### Properties

##### err?

> `optional` **err?**: (`error`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:53](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L53)

###### Parameters

##### error

`Error`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### nil?

> `optional` **nil?**: () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:54](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L54)

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)

***

##### ok

> **ok**: (`value`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:52](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L52)

###### Parameters

##### value

`T`

###### Returns

[`MaybeCleanup`](MaybeCleanup.md)
