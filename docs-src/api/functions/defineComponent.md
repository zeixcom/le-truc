### Function: defineComponent()

#### Call Signature

> **defineComponent**\<`P`\>(`name`, `factory`): `HTMLElement` & `P`

Defined in: [src/component.ts:268](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L268)

Define and register a reactive custom element using the v1.1 factory form.

The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
the `host` element, and `expose()` for declaring reactive properties. It returns a flat
array of effect descriptors created by helpers like `watch()`, `on()`, `each()`, `pass()`,
and `provideContexts()`.

Effects activate after dependency resolution — child custom elements are guaranteed to
be defined before any descriptor runs.

##### Type Parameters

###### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### Parameters

###### name

`string`

Custom element name (must contain a hyphen and start with a lowercase letter)

###### factory

(`context`) => [`FactoryResult`](../type-aliases/FactoryResult.md)

Factory function that queries elements, calls expose(), and returns effect descriptors

##### Returns

`HTMLElement` & `P`

##### Since

1.1

##### Throws

If the component name is not a valid custom element name

#### Call Signature

> **defineComponent**\<`P`, `U`\>(`name`, `props?`, `select?`, `setup?`): `HTMLElement` & `P`

Defined in: [src/component.ts:289](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L289)

Define and register a reactive custom element using the v1.0 4-param form.

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

`HTMLElement` & `P`

##### Deprecated

Use the v1.1 factory form `defineComponent(name, factory)` with `expose()` and effect descriptors instead.
The 4-param form remains fully supported for components that require attribute-reactive `observedAttributes`.

##### Since

0.15.0

##### Throws

If the component name is not a valid custom element name

##### Throws

If a property name conflicts with reserved words or inherited HTMLElement properties
