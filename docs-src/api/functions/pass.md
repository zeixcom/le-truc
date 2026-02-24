### Function: pass()

> **pass**\<`P`, `Q`\>(`props`): [`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Defined in: [src/effects/pass.ts:51](https://github.com/zeixcom/le-truc/blob/c76fdd788c0b9a613a5dd883bb02ba2aa0c3b1ba/src/effects/pass.ts#L51)

Effect for passing reactive values to a descendant Le Truc component.

Replaces the backing signal of the target's Slot, creating a live
parent→child binding. The original signal is captured and restored when the
parent disconnects, so the child regains its own independent state after
detachment.

Scope: Le Truc components only (targets whose properties are Slot-backed).
For non-Le Truc custom elements or plain HTML elements, use `setProperty()`
instead — it goes through the element's public setter and is always correct
regardless of the child's internal framework.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### Q

`Q` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

#### Parameters

##### props

Reactive values to pass

[`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\> | (`target`) => [`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\>

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Effect function that passes reactive values to the descendant component

#### Since

0.15.0

#### Throws

When the target element is not a valid custom element

#### Throws

When the provided reactives is not a record of signals, reactive property names or functions
