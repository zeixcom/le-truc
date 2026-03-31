### Type Alias: ComponentUI\<P, U\>

> **ComponentUI**\<`P`, `U`\> = `U` & `object`

Defined in: [src/component.ts:55](https://github.com/zeixcom/le-truc/blob/f1a3efe48ad5bc44f3a6d0e565f5dfe468144c70/src/component.ts#L55)

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
