[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / match

# Function: match()

> **match**\<`T`\>(`signals`, `handlers`): [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:47

Runs handlers based on the current values of signals.
Must be called within an active owner (effect or scope) so async cleanup can be registered.

## Type Parameters

### T

`T` *extends* readonly [`Signal`](../type-aliases/Signal.md)\<\{ \}\>[]

## Parameters

### signals

readonly \[`T`\]

### handlers

[`MatchHandlers`](../type-aliases/MatchHandlers.md)\<`T`\>

## Returns

[`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

## Since

0.15.0

## Throws

RequiredOwnerError If called without an active owner.
