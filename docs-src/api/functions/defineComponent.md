### Function: defineComponent()

> **defineComponent**\<`P`\>(`name`, `factory`): `CustomElementConstructor` \| `undefined`

Defined in: [src/component.ts:130](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/component.ts#L130)

Define and register a reactive custom element using the v1.1 factory form.

The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
the `host` element, and `expose()` for declaring reactive properties. It returns a flat
array of effect descriptors created by helpers like `watch()`, `on()`, `pass()`,
`provideContexts()`, and `requestContext()`.

Effects activate after dependency resolution — child custom elements are guaranteed to
be defined before any descriptor runs.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

#### Parameters

##### name

`string`

Custom element name (must contain a hyphen and start with a lowercase letter)

##### factory

(`context`) => `void` \| [`Falsy`](../type-aliases/Falsy.md) \| [`FactoryResult`](../type-aliases/FactoryResult.md)

Factory function that queries elements, calls expose(), and returns effect descriptors

#### Returns

`CustomElementConstructor` \| `undefined`

#### Since

2.0

#### Throws

If the component name is not a valid custom element name
