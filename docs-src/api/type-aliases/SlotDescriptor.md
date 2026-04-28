### Type Alias: SlotDescriptor\<T\>

> **SlotDescriptor**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:7

A descriptor for a derived reactive value with an optional setter.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value

#### Methods

##### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:9

Reads the value, tracking dependencies.

###### Returns

`T`

***

##### set()?

> `optional` **set**(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:11

Optional setter to update the source value.

###### Parameters

##### next

`T`

###### Returns

`void`
