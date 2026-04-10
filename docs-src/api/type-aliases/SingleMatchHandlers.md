### Type Alias: SingleMatchHandlers\<T\>

> **SingleMatchHandlers**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:24

Handlers for a single signal passed to `match()`.

#### Type Parameters

##### T

`T` *extends* `object`

The value type of the signal being matched

#### Properties

##### err?

> `optional` **err?**: (`error`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:28

Called when the signal holds an error. Receives the error directly. Defaults to `console.error`.

###### Parameters

##### error

`Error`

###### Returns

[`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

##### nil?

> `optional` **nil?**: () => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:30

Called when the signal is unset (pending).

###### Returns

[`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

##### ok

> **ok**: (`value`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:26

Called when the signal has a value. Receives the resolved value directly.

###### Parameters

##### value

`T`

###### Returns

[`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>
