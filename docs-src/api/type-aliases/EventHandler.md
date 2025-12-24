[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandler

# Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:13](https://github.com/zeixcom/le-truc/blob/278ab0df3fbdca5f6b0f0436bf1688626c821080/src/effects/event.ts#L13)

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
