[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / State

# Class: State\<T\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:8

Create a new state signal.

## Since

0.17.0

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new State**\<`T`\>(`initialValue`): `State`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:17

Create a new state signal.

#### Parameters

##### initialValue

`T`

Initial value of the state

#### Returns

`State`\<`T`\>

#### Throws

- If the initial value is null or undefined

#### Throws

- If the initial value is invalid

## Accessors

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:18

##### Returns

`string`

## Methods

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:24

Get the current value of the state signal.

#### Returns

`T`

- Current value of the state

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:51

Register a callback to be called when HOOK_WATCH is triggered.

#### Parameters

##### type

`"watch"`

The type of hook to register the callback for; only HOOK_WATCH is supported

##### callback

`HookCallback`

The callback to register

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

- A function to unregister the callback

***

### set()

> **set**(`newValue`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:33

Set the value of the state signal.

#### Parameters

##### newValue

`T`

New value of the state

#### Returns

`void`

#### Throws

- If the initial value is null or undefined

#### Throws

- If the initial value is invalid

***

### update()

> **update**(`updater`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/state.d.ts:43

Update the value of the state signal.

#### Parameters

##### updater

(`oldValue`) => `T`

Function that takes the current value and returns the new value

#### Returns

`void`

#### Throws

- If the updater function is not a function

#### Throws

- If the initial value is null or undefined

#### Throws

- If the initial value is invalid
