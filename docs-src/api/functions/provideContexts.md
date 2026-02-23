### Function: provideContexts()

> **provideContexts**\<`P`\>(`contexts`): (`host`) => [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/context.ts:108](https://github.com/zeixcom/le-truc/blob/45798dee9dae4e450a431014c6b066824d261d20/src/context.ts#L108)

Make reactive properties of this component available to descendant consumers via the context protocol.

Returns a `MethodProducer` — use it as a property initializer in `defineComponent`.
It attaches a `context-request` listener to the host; when a matching request arrives,
it provides a getter `() => host[context]` to the requester.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

#### Parameters

##### contexts

keyof `P`[]

Reactive property names to expose as context

#### Returns

MethodProducer that installs the listener and returns a cleanup function

> (`host`): [`Cleanup`](../type-aliases/Cleanup.md)

##### Parameters

###### host

[`Component`](../type-aliases/Component.md)\<`P`\>

##### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

#### Since

0.13.3
