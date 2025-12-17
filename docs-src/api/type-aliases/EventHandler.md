[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandler

# Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:13](https://github.com/zeixcom/le-truc/blob/4749c9b4f33eb880ace4f2b7198b83131037c93e/src/effects/event.ts#L13)

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
