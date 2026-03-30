### Type Alias: ComponentSetup\<P, U\>

> **ComponentSetup**\<`P`, `U`\> = (`ui`) => [`Effects`](Effects.md)\<`P`, [`ComponentUI`](ComponentUI.md)\<`P`, `U`\>\>

Defined in: [src/component.ts:63](https://github.com/zeixcom/le-truc/blob/8e260db69c2a07fca5b7a6e4feb1c02c605094f0/src/component.ts#L63)

The type of the `setup` function passed to `defineComponent`.
Receives the frozen UI object (including `host`) and returns an `Effects` record.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)

#### Parameters

##### ui

[`ComponentUI`](ComponentUI.md)\<`P`, `U`\>

#### Returns

[`Effects`](Effects.md)\<`P`, [`ComponentUI`](ComponentUI.md)\<`P`, `U`\>\>
