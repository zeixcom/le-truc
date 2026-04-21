### Function: defineComponent()

> **defineComponent**\<`P`\>(`name`, `factory`): `CustomElementConstructor` \| `undefined`

Defined in: [src/component.ts:131](https://github.com/zeixcom/le-truc/blob/3d378e339ca819861372f356f408d3d000b2c62c/src/component.ts#L131)

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
