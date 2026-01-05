[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Ref

# Class: Ref\<T\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:9

Create a new ref signal.

## Since

0.17.1

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new Ref**\<`T`\>(`value`, `guard?`): `Ref`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:19

Create a new ref signal.

#### Parameters

##### value

`T`

Reference to external object

##### guard?

[`Guard`](../type-aliases/Guard.md)\<`T`\>

Optional guard function to validate the value

#### Returns

`Ref`\<`T`\>

#### Throws

- If the value is null or undefined

#### Throws

- If the value is invalid

## Accessors

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `string`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:20

##### Returns

`string`

## Methods

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:26

Get the value of the ref signal.

#### Returns

`T`

- Object reference

***

### notify()

> **notify**(): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:30

Notify watchers of relevant changes in the external reference.

#### Returns

`void`

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/ref.d.ts:38

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
