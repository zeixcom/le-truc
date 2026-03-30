### Type Alias: ComponentUI\<P, U\>

> **ComponentUI**\<`P`, `U`\> = `U` & `object`

Defined in: [src/component.ts:55](https://github.com/zeixcom/le-truc/blob/3386ff28c36c911ef6de374d52dbcc7da589393b/src/component.ts#L55)

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
