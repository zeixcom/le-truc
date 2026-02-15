[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / runElementEffects

# Function: runElementEffects()

> **runElementEffects**\<`P`, `E`\>(`host`, `target`, `effects`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: [src/effects.ts:96](https://github.com/zeixcom/le-truc/blob/f24c1c5bc3c2b0911801769c1a46c70e066ccb8e/src/effects.ts#L96)

Run element effects

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### E

`E` *extends* `Element`

## Parameters

### host

[`Component`](../type-aliases/Component.md)\<`P`\>

Host component

### target

`E`

Target element

### effects

[`ElementEffects`](../type-aliases/ElementEffects.md)\<`P`, `E`\>

Effect functions to run

## Returns

[`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

- Cleanup function that runs collected cleanup functions

## Since

0.15.0

## Throws

- If the effects are invalid
