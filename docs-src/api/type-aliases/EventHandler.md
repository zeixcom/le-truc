[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandler

# Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:10](https://github.com/zeixcom/le-truc/blob/29df9dc153407528423acb370c4f28ebc628bed2/src/effects/event.ts#L10)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### Evt

`Evt` *extends* `Event`

## Parameters

### event

`Evt`

## Returns

`{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>
