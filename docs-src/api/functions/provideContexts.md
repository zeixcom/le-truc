### Function: provideContexts()

> **provideContexts**\<`P`\>(`contexts`): (`host`) => [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/context.ts:111](https://github.com/zeixcom/le-truc/blob/8e260db69c2a07fca5b7a6e4feb1c02c605094f0/src/context.ts#L111)

Make reactive properties of this component available to descendant consumers via the context protocol.

Use in the setup function as `host: provideContexts([...])` — it is an `Effect`, not a property
initializer. It attaches a `context-request` listener to the host via `createScope`; when a
matching request arrives, it provides a getter `() => host[context]` to the requester.
The listener is removed on `disconnectedCallback` via the effect cleanup.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

#### Parameters

##### contexts

keyof `P`[]

Reactive property names to expose as context

#### Returns

Effect that installs the context-request listener and returns a cleanup function

(`host`) => [`Cleanup`](../type-aliases/Cleanup.md)

#### Since

0.13.3
