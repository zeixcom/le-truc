### Function: defineComponent()

> **defineComponent**\<`P`\>(`name`, `factory`): `HTMLElement` & `P`

Defined in: [src/component.ts:241](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L241)

Define and register a reactive custom element using the v1.1 factory form.

The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
the `host` element, and `expose()` for declaring reactive properties. It returns a flat
array of effect descriptors created by helpers like `watch()`, `on()`, `each()`, `pass()`,
and `provideContexts()`.

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

(`context`) => [`FactoryResult`](../type-aliases/FactoryResult.md)

Factory function that queries elements, calls expose(), and returns effect descriptors

#### Returns

`HTMLElement` & `P`

#### Since

1.1

#### Throws

If the component name is not a valid custom element name
