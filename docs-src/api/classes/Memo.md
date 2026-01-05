[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Memo

# Class: Memo\<T\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:18

Create a new memoized signal for a synchronous function.

## Since

0.17.0

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new Memo**\<`T`\>(`callback`, `initialValue?`): `Memo`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:28

Create a new memoized signal.

#### Parameters

##### callback

`MemoCallback`\<`T`\>

Callback function to compute the memoized value

##### initialValue?

`T`

Initial value of the signal

#### Returns

`Memo`\<`T`\>

#### Throws

If the callback is not an sync function

#### Throws

If the initial value is not valid

## Accessors

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `"Computed"`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:29

##### Returns

`"Computed"`

## Methods

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:37

Return the memoized value after computing it if necessary.

#### Returns

`T`

#### Throws

If a circular dependency is detected

#### Throws

If an error occurs during computation

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:45

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
