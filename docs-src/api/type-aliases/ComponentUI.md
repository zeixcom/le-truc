### ~~Type Alias: ComponentUI\<P, U\>~~

> **ComponentUI**\<`P`, `U`\> = `U` & `object`

Defined in: [src/component.ts:78](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L78)

The UI object passed to the `setup` function: the result of the `select`
function merged with a `host` key pointing to the component element itself.

#### Type Declaration

##### ~~host~~

> **host**: `HTMLElement` & `P`

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)

#### Deprecated

Used only by the v1.0 4-param form of `defineComponent`. Use the v1.1 factory form with `FactoryContext` instead.
