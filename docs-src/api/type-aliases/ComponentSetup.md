### Type Alias: ComponentSetup\<P, U\>

> **ComponentSetup**\<`P`, `U`\> = (`ui`) => [`Effects`](Effects.md)\<`P`, [`ComponentUI`](ComponentUI.md)\<`P`, `U`\>\>

Defined in: [src/component.ts:63](https://github.com/zeixcom/le-truc/blob/96be5a879e7c58444a2b3e7d9c595138795a386d/src/component.ts#L63)

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
