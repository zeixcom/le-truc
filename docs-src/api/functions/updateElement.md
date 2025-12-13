[**le-truc**](../README.md)

***

[le-truc](../globals.md) / updateElement

# Function: updateElement()

> **updateElement**\<`T`, `P`, `E`\>(`reactive`, `updater`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects.ts:261](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/effects.ts#L261)

Core effect function for updating element properties based on reactive values.
This function handles the lifecycle of reading, updating, and deleting element properties
while providing proper error handling and debugging support.

## Type Parameters

### T

`T` *extends* `object`

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### E

`E` *extends* `Element`

## Parameters

### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`T`, `P`, `E`\>

The reactive value that drives the element updates

### updater

`ElementUpdater`\<`E`, `T`\>

Configuration object defining how to read, update, and delete the element property

## Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that manages the element property updates

## Since

0.9.0
