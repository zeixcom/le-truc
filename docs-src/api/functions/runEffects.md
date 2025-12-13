[**le-truc**](../README.md)

***

[le-truc](../globals.md) / runEffects

# Function: runEffects()

> **runEffects**\<`P`, `U`\>(`ui`, `effects`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/effects.ts:174](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/effects.ts#L174)

Run component effects

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### U

`U` *extends* [`UI`](../type-aliases/UI.md) & `object`

## Parameters

### ui

`U`

Component UI

### effects

[`Effects`](../type-aliases/Effects.md)\<`P`, `U`\>

Effect functions to run

## Returns

[`Cleanup`](../type-aliases/Cleanup.md)

- Cleanup function that runs collected cleanup functions

## Since

0.15.0

## Throws

- If the effects are invalid
