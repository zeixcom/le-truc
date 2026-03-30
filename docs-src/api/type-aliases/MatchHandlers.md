### Type Alias: MatchHandlers\<T\>

> **MatchHandlers**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:9

Handlers for all states of one or more signals passed to `match()`.

#### Type Parameters

##### T

`T` *extends* readonly [`Signal`](Signal.md)\<`unknown` & `object`\>[]

Tuple of `Signal` types being matched

#### Properties

##### err?

> `optional` **err?**: (`errors`) => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:15

Called when one or more signals hold an error. Defaults to `console.error`.

###### Parameters

##### errors

readonly `Error`[]

###### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

##### nil?

> `optional` **nil?**: () => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:17

Called when one or more signals are unset (pending).

###### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

***

##### ok

> **ok**: (`values`) => `MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:11

Called when all signals have a value. Receives a tuple of resolved values.

###### Parameters

##### values

`{ [K in keyof T]: T[K] extends Signal<infer V> ? V : never }`

###### Returns

`MaybePromise`\<[`MaybeCleanup`](MaybeCleanup.md)\>
