### ~~Function: pass()~~

> **pass**\<`P`, `Q`\>(`props`): [`Effect`](../type-aliases/Effect.md)\<`P`, `HTMLElement` & `Q`\>

Defined in: [src/effects/pass.ts:62](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects/pass.ts#L62)

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

[`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\> \| ((`target`) => [`PassedProps`](../type-aliases/PassedProps.md)\<`P`, `Q`\>)

Reactive values to pass

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `HTMLElement` & `Q`\>

Effect function that passes reactive values to the descendant component

#### Deprecated

Use the `pass(target, props)` helper from `FactoryContext` in the v1.1 factory form instead.
The factory helper returns an `EffectDescriptor` and takes the target element as its first argument.

#### Since

0.15.0

#### Throws

When the target element is not a valid custom element

#### Throws

When the provided reactives is not a record of signals, reactive property names or functions
