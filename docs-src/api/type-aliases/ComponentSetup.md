### Type Alias: ComponentSetup()\<P, U\>

> **ComponentSetup**\<`P`, `U`\> = (`ui`) => [`Effects`](Effects.md)\<`P`, [`ComponentUI`](ComponentUI.md)\<`P`, `U`\>\>

Defined in: [src/component.ts:63](https://github.com/zeixcom/le-truc/blob/d8168684fc4cb8d811d0fffec6f48f3c78b3f3fb/src/component.ts#L63)

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
