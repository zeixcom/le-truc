[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Task

# Class: Task\<T\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:52

Create a new task signals that memoizes the result of an asynchronous function.

## Since

0.17.0

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new Task**\<`T`\>(`callback`, `initialValue?`): `Task`\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:62

Create a new task signal for an asynchronous function.

#### Parameters

##### callback

`TaskCallback`\<`T`\>

The asynchronous function to compute the memoized value

##### initialValue?

`T`

Initial value of the signal

#### Returns

`Task`\<`T`\>

#### Throws

If the callback is not an async function

#### Throws

If the initial value is not valid

## Accessors

### \[toStringTag\]

#### Get Signature

> **get** **\[toStringTag\]**(): `"Computed"`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:63

##### Returns

`"Computed"`

## Methods

### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:71

Return the memoized value after executing the async function if necessary.

#### Returns

`T`

#### Throws

If a circular dependency is detected

#### Throws

If an error occurs during computation

***

### on()

> **on**(`type`, `callback`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/computed.d.ts:79

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
