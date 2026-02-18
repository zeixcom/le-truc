[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / on

# Function: on()

> **on**\<`K`, `P`, `E`\>(`type`, `handler`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/event.ts:27](https://github.com/zeixcom/le-truc/blob/5c30877fa2fce96dab1ef679e495da98511e97d7/src/effects/event.ts#L27)

Effect for attaching an event listener to an element.
Provides proper cleanup when the effect is disposed.

## Type Parameters

### K

`K` *extends* `string`

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### E

`E` *extends* `Element` = `HTMLElement`

## Parameters

### type

`K`

Event type

### handler

[`EventHandler`](../type-aliases/EventHandler.md)\<`P`, [`EventType`](../type-aliases/EventType.md)\<`K`\>\>

Event handler function

### options?

`AddEventListenerOptions` = `{}`

Event listener options

## Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that manages the event listener

## Since

0.14.0
