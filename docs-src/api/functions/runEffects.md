[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / runEffects

# Function: runEffects()

> **runEffects**\<`P`, `U`\>(`ui`, `effects`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/effects.ts:167](https://github.com/zeixcom/le-truc/blob/97c33707458c1ba34fa25436c665f488718b79cf/src/effects.ts#L167)

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
