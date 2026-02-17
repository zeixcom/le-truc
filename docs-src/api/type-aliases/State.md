[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / State

# Type Alias: State\<T\>

> **State**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:16

A mutable reactive state container.
Changes to the state will automatically propagate to dependent computations and effects.

## Type Parameters

### T

`T` *extends* `object`

The type of value stored in the state

## Properties

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"State"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:17

## Methods

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:23

Gets the current value of the state.
When called inside a memo, task, or effect, creates a dependency.

#### Returns

`T`

The current value

***

### set()

> **set**(`next`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:29

Sets a new value for the state.
If the new value is different (according to the equality function), all dependents will be notified.

#### Parameters

##### next

`T`

The new value to set

#### Returns

`void`

***

### update()

> **update**(`fn`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:35

Updates the state with a new value computed by a callback function.
The callback receives the current value as an argument.

#### Parameters

##### fn

`UpdateCallback`\<`T`\>

The callback function to compute the new value

#### Returns

`void`
