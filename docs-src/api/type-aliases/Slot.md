### Type Alias: Slot\<T\>

> **Slot**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:13

A signal that delegates its value to a swappable backing signal.

Slots provide a stable reactive source at a fixed position (e.g. an object property)
while allowing the backing signal to be replaced without breaking subscribers.
The object shape is compatible with `Object.defineProperty()` descriptors:
`get`, `set`, `configurable`, and `enumerable` are used by the property definition;
`replace()` and `current()` are kept on the slot object for integration-layer control.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value held by the delegated signal.

#### Properties

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Slot"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:14

***

##### configurable

> **configurable**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:16

Descriptor field: allows the property to be redefined or deleted.

***

##### enumerable

> **enumerable**: `true`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:18

Descriptor field: the property shows up during enumeration.

#### Methods

##### current()

> **current**(): [`Signal`](Signal.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:26

Returns the currently delegated signal.

###### Returns

[`Signal`](Signal.md)\<`T`\>

***

##### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:20

Reads the current value from the delegated signal, tracking dependencies.

###### Returns

`T`

***

##### replace()

> **replace**\<`U`\>(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:24

Swaps the backing signal, invalidating all downstream subscribers. Narrowing (`U extends T`) is allowed.

###### Type Parameters

##### U

`U` *extends* `object`

###### Parameters

##### next

[`Signal`](Signal.md)\<`U`\>

###### Returns

`void`

***

##### set()

> **set**(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:22

Writes a value to the delegated signal. Throws `ReadonlySignalError` if the delegated signal is read-only.

###### Parameters

##### next

`T`

###### Returns

`void`
