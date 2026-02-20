### Function: provideContexts()

> **provideContexts**\<`P`\>(`contexts`): (`host`) => [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/context.ts:105](https://github.com/zeixcom/le-truc/blob/b2bd37a6fe13095f4a2fd459382f54953f446e56/src/context.ts#L105)

Provide a context for descendant component consumers

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

#### Parameters

##### contexts

keyof `P`[]

Array of contexts to provide

#### Returns

Function to add an event listener for ContextRequestEvent returning a cleanup function to remove the event listener

> (`host`): [`Cleanup`](../type-aliases/Cleanup.md)

##### Parameters

###### host

[`Component`](../type-aliases/Component.md)\<`P`\>

##### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

#### Since

0.13.3
