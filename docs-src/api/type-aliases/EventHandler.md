[**le-truc**](../README.md)

***

[le-truc](../globals.md) / EventHandler

# Type Alias: EventHandler()\<P, E, Evt\>

> **EventHandler**\<`P`, `E`, `Evt`\> = (`context`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:13](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/effects/event.ts#L13)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### E

`E` *extends* `Element`

### Evt

`Evt` *extends* `Event`

## Parameters

### context

#### event

`Evt`

#### host

[`Component`](Component.md)\<`P`\>

#### target

`E`

## Returns

`{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>
