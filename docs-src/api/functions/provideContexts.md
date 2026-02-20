### Function: provideContexts()

> **provideContexts**\<`P`\>(`contexts`): (`host`) => [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: [src/context.ts:105](https://github.com/zeixcom/le-truc/blob/9bf1182113652328495f1c47a23356331bfe23f3/src/context.ts#L105)

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
