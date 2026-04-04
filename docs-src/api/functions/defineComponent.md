### Function: defineComponent()

#### Call Signature

> **defineComponent**\<`P`, `U`\>(`name`, `factory`): [`Component`](../type-aliases/Component.md)\<`P`\>

Defined in: [src/component.ts:145](https://github.com/zeixcom/le-truc/blob/4623838db83f9ada1ce0c2179fd724f26d6376e6/src/component.ts#L145)

Define and register a reactive custom element using the 2-param factory form.

The factory receives `{ first, all, host }` at connect time and returns `{ ui, props?, effects? }`.
UI elements, props initializers, and effects share a single closure scope — no `ui` object is
passed between functions. Components defined this way do not use `observedAttributes`; reactive
state is managed entirely through the signal-backed property interface.

##### Type Parameters

###### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

###### U

`U` *extends* [`UI`](../type-aliases/UI.md) = \{ \}

##### Parameters

###### name

`string`

Custom element name (must contain a hyphen and start with a lowercase letter)

###### factory

`ComponentFactory`\<`P`, `U`\>

Factory function that queries elements and returns ui, props, and effects

##### Returns

[`Component`](../type-aliases/Component.md)\<`P`\>

##### Since

1.1

##### Throws

If the component name is not a valid custom element name

#### Call Signature

> **defineComponent**\<`P`, `U`\>(`name`, `props?`, `select?`, `setup?`): [`Component`](../type-aliases/Component.md)\<`P`\>

Defined in: [src/component.ts:164](https://github.com/zeixcom/le-truc/blob/4623838db83f9ada1ce0c2179fd724f26d6376e6/src/component.ts#L164)

Define and register a reactive custom element.

Calls `customElements.define()` and returns the registered class.
Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.

##### Type Parameters

###### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

###### U

`U` *extends* [`UI`](../type-aliases/UI.md) = \{ \}

##### Parameters

###### name

`string`

Custom element name (must contain a hyphen and start with a lowercase letter)

###### props?

[`Initializers`](../type-aliases/Initializers.md)\<`P`, `U`\>

Initializers for reactive properties: static values, signals, parsers, or readers

###### select?

(`elementQueries`) => `U`

Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)

###### setup?

(`ui`) => [`Effects`](../type-aliases/Effects.md)\<`P`, [`ComponentUI`](../type-aliases/ComponentUI.md)\<`P`, `U`\>\>

Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name

##### Returns

[`Component`](../type-aliases/Component.md)\<`P`\>

##### Since

0.15.0

##### Throws

If the component name is not a valid custom element name

##### Throws

If a property name conflicts with reserved words or inherited HTMLElement properties
