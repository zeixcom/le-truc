### Function: pass()

> **pass**\<`P`, `Q`\>(`props`): [`Effect`](../type-aliases/Effect.md)\<`P`, [`Component`](../type-aliases/Component.md)\<`Q`\>\>

Defined in: [src/effects/pass.ts:50](https://github.com/zeixcom/le-truc/blob/45798dee9dae4e450a431014c6b066824d261d20/src/effects/pass.ts#L50)

Effect for passing reactive values to a descendant component.

**Le Truc targets (Slot-backed properties):** Replaces the backing signal of the
target's Slot, creating a live parent→child binding. The original signal is restored
on cleanup so the child can be safely detached and reattached.

**Other custom elements (Object.defineProperty fallback):** Overrides the property
descriptor on the target instance with a reactive getter (and optional setter for
two-way binding). The original descriptor is restored on cleanup. In DEV_MODE, logs
a warning if the descriptor is non-configurable and the binding cannot be installed.

Scope: custom elements only (elements whose `localName` contains a hyphen).
For plain HTML elements, use `setProperty()` instead.

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
