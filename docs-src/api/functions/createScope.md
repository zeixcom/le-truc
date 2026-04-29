### Function: createScope()

> **createScope**(`fn`, `options?`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:274

Creates a new ownership scope for managing cleanup of nested effects and resources.
All effects created within the scope will be automatically disposed when the scope is disposed.
Scopes can be nested — disposing a parent scope disposes all child scopes.

By default, if the scope is created inside another owner (an effect or a parent scope),
its disposal is automatically registered on that owner. Pass `{ root: true }` to suppress
this registration, making the returned `dispose` the sole teardown mechanism — required
when an external lifecycle authority (such as a web component's `disconnectedCallback`)
is responsible for cleanup.

#### Parameters

##### fn

() => [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

The function to execute within the scope, may return a cleanup function

##### options?

[`ScopeOptions`](../type-aliases/ScopeOptions.md)

Optional scope configuration

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

A dispose function that cleans up the scope

#### Examples

```ts
const dispose = createScope(() => {
  const count = createState(0);
  createEffect(() => { console.log(count.get()); });
  return () => console.log('Scope disposed');
});
dispose();
```

```ts
class MyElement extends HTMLElement {
  #dispose?: () => void;

  connectedCallback() {
    this.#dispose = createScope(() => {
      createEffect(() => { this.textContent = label.get(); });
    }, { root: true });
  }

  disconnectedCallback() {
    this.#dispose?.();
  }
}
```
