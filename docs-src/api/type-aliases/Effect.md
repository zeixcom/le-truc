### Type Alias: Effect\<P, E\>

> **Effect**\<`P`, `E`\> = (`host`, `target`) => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:46](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L46)

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

`HTMLElement` & `P`

##### target

`E`

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
