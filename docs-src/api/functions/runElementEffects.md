[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / runElementEffects

# Function: runElementEffects()

> **runElementEffects**\<`P`, `E`\>(`host`, `target`, `effects`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: [src/effects.ts:89](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/effects.ts#L89)

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
