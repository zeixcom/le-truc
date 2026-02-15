[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / runEffects

# Function: runEffects()

> **runEffects**\<`P`, `U`\>(`ui`, `effects`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/effects.ts:175](https://github.com/zeixcom/le-truc/blob/f24c1c5bc3c2b0911801769c1a46c70e066ccb8e/src/effects.ts#L175)

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
