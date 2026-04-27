### Type Alias: ListOptions\<T\>

> **ListOptions**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:24

Configuration options for `createList`.

#### Type Parameters

##### T

`T` *extends* `object`

The type of items in the list

#### Properties

##### createItem?

> `optional` **createItem?**: (`value`) => `MutableSignal`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:32

Factory for per-item signals. Defaults to `createState`.

###### Parameters

##### value

`T`

###### Returns

`MutableSignal`\<`T`\>

***

##### itemEquals?

> `optional` **itemEquals?**: (`a`, `b`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:30

Equality function for item state signals. Defaults to reference equality (`===`).

###### Parameters

##### a

`T`

##### b

`T`

###### Returns

`boolean`

***

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
