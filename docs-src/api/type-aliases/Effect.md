### Type Alias: Effect\<P, E\>

> **Effect**\<`P`, `E`\> = (`host`, `target`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:27](https://github.com/zeixcom/le-truc/blob/aeeac355aad9805eb8ee281d5c2dacf08589e2c9/src/effects.ts#L27)

A single effect function bound to a host component and a target element.
Returned by built-in effect factories (`setText`, `setAttribute`, `on`, etc.)
and by `updateElement`. May return a cleanup function that runs when the
component disconnects or when the target element is removed.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### host

[`Component`](Component.md)\<`P`\>

##### target

`E`

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
