### Type Alias: ComponentUI\<P, U\>

> **ComponentUI**\<`P`, `U`\> = `U` & `object`

Defined in: [src/component.ts:55](https://github.com/zeixcom/le-truc/blob/e8c0d32e69c325915ecdafadce2c86cae289ff85/src/component.ts#L55)

The UI object passed to the `setup` function: the result of the `select`
function merged with a `host` key pointing to the component element itself.

#### Type Declaration

##### host

> **host**: [`Component`](Component.md)\<`P`\>

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
