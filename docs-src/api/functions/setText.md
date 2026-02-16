[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / setText

# Function: setText()

> **setText**\<`P`, `E`\>(`reactive`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/text.ts:14](https://github.com/zeixcom/le-truc/blob/a6eb6ebcd7352b6a07349eccb67cc61a478cd06f/src/effects/text.ts#L14)

Effect for setting the text content of an element.
Replaces all child nodes (except comments) with a single text node.

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### E

`E` *extends* `Element`

## Parameters

### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\>

Reactive value bound to the text content

## Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the text content of the element

## Since

0.8.0
