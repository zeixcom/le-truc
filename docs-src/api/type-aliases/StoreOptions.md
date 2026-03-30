### Type Alias: StoreOptions

> **StoreOptions** = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:7

Configuration options for `createStore`.

#### Properties

##### watched?

> `optional` **watched?**: () => [`Cleanup`](Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:9

Invoked when the store gains its first downstream subscriber; returns a cleanup called when the last one unsubscribes.

###### Returns

[`Cleanup`](Cleanup.md)
