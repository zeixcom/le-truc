[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / pass

# Function: pass()

> **pass**\<`P`, `Q`\>(`props`): [`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Defined in: [src/effects/pass.ts:42](https://github.com/zeixcom/le-truc/blob/29df9dc153407528423acb370c4f28ebc628bed2/src/effects/pass.ts#L42)

Effect for passing reactive values to a descendant Le Truc component
by replacing the backing signal of the target's Slot.

No cleanup/restore is needed: when the parent unmounts, the child
is torn down as well. For re-parenting scenarios, use context instead.

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### Q

`Q` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

## Parameters

### props

Reactive values to pass

[`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\> | (`target`) => [`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\>

## Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Effect function that passes reactive values to the descendant component

## Since

0.15.0

## Throws

When the target element is not a valid custom element

## Throws

When the provided reactives is not a record of signals, reactive property names or functions
