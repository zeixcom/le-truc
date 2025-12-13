[**le-truc**](../README.md)

***

[le-truc](../globals.md) / toSignal

# Function: toSignal()

> **toSignal**\<`T`\>(`value`): `T` *extends* [`Store`](../type-aliases/Store.md)\<`U`\> ? [`Store`](../type-aliases/Store.md)\<`U`\> : `T` *extends* [`State`](../type-aliases/State.md)\<`U`\> ? [`State`](../type-aliases/State.md)\<`U`\> : `T` *extends* [`Computed`](../type-aliases/Computed.md)\<`U`\> ? [`Computed`](../type-aliases/Computed.md)\<`U`\> : `T` *extends* [`Signal`](../type-aliases/Signal.md)\<`U`\> ? [`Signal`](../type-aliases/Signal.md)\<`U`\> : `T` *extends* readonly `U`[] ? [`Store`](../type-aliases/Store.md)\<`U`[]\> : `T` *extends* `Record`\<`string`, \{ \}\> ? [`Store`](../type-aliases/Store.md)\<\{ \[K in string \| number \| symbol\]: T\<T\>\[K\] \}\> : `T` *extends* [`ComputedCallback`](../type-aliases/ComputedCallback.md)\<`U`\> ? [`Computed`](../type-aliases/Computed.md)\<`U`\> : [`State`](../type-aliases/State.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/signal.d.ts:34

Convert a value to a Signal if it's not already a Signal

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### value

`T`

value to convert

## Returns

`T` *extends* [`Store`](../type-aliases/Store.md)\<`U`\> ? [`Store`](../type-aliases/Store.md)\<`U`\> : `T` *extends* [`State`](../type-aliases/State.md)\<`U`\> ? [`State`](../type-aliases/State.md)\<`U`\> : `T` *extends* [`Computed`](../type-aliases/Computed.md)\<`U`\> ? [`Computed`](../type-aliases/Computed.md)\<`U`\> : `T` *extends* [`Signal`](../type-aliases/Signal.md)\<`U`\> ? [`Signal`](../type-aliases/Signal.md)\<`U`\> : `T` *extends* readonly `U`[] ? [`Store`](../type-aliases/Store.md)\<`U`[]\> : `T` *extends* `Record`\<`string`, \{ \}\> ? [`Store`](../type-aliases/Store.md)\<\{ \[K in string \| number \| symbol\]: T\<T\>\[K\] \}\> : `T` *extends* [`ComputedCallback`](../type-aliases/ComputedCallback.md)\<`U`\> ? [`Computed`](../type-aliases/Computed.md)\<`U`\> : [`State`](../type-aliases/State.md)\<`T`\>

- Signal instance

## Since

0.9.6
