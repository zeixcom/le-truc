[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / pass

# Function: pass()

> **pass**\<`P`, `Q`\>(`props`): [`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Defined in: [src/effects/pass.ts:39](https://github.com/zeixcom/le-truc/blob/d42fb28a360f26c2ef62cbc9c1f4f11dd0f59654/src/effects/pass.ts#L39)

Effect for passing reactive values to a descendant Le Truc component.

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

## Throws

When passing signals failed for some other reason
