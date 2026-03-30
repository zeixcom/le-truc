### Type Alias: ListOptions\<T\>

> **ListOptions**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:24

Configuration options for `createList`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the list

#### Properties

##### keyConfig?

> `optional` **keyConfig?**: `KeyConfig`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:26

Key generation strategy. A string prefix or a function `(item) => string | undefined`. Defaults to auto-increment.

***

##### watched?

> `optional` **watched?**: () => [`Cleanup`](Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:28

Lifecycle callback invoked when the list gains its first downstream subscriber. Must return a cleanup function.

###### Returns

[`Cleanup`](Cleanup.md)
