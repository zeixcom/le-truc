[**le-truc**](../README.md)

***

[le-truc](../globals.md) / EventHandler

# Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:13](https://github.com/zeixcom/le-truc/blob/5bd629bc02429c8193f06a75f94397faf30ed891/src/effects/event.ts#L13)

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
