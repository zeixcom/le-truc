### Type Alias: Memo\<T\>

> **Memo**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/memo.d.ts:8

A derived reactive computation that caches its result.
Automatically tracks dependencies and recomputes when they change.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value computed by the memo

#### Properties

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Memo"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/memo.d.ts:9

#### Methods

##### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/memo.d.ts:17

Gets the current value of the memo.
Recomputes if dependencies have changed since last access.
When called inside another reactive context, creates a dependency.

###### Returns

`T`

The computed value

###### Throws

UnsetSignalValueError If the memo value is still unset when read.
