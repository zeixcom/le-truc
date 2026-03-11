### Type Alias: ComponentUI\<P, U\>

> **ComponentUI**\<`P`, `U`\> = `U` & `object`

Defined in: [src/component.ts:55](https://github.com/zeixcom/le-truc/blob/57d2b0db1f6c756c7b3c7143d93400fec84a7617/src/component.ts#L55)

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
