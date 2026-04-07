### Function: asMethod()

> **asMethod**\<`T`\>(`fn`): `T` & `object`

Defined in: [src/parsers.ts:127](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/parsers.ts#L127)

Brand a function with the `METHOD_BRAND` symbol so it is exposed as a method on the component host.

The function passed to `asMethod()` IS the method — it is assigned directly as the property value when `expose()` processes it. Per-instance state should be declared in the factory scope (before `expose()`).

#### Type Parameters

##### T

`T` *extends* (...`args`) => `void`

#### Parameters

##### fn

`T`

The method function to brand

#### Returns

`T` & `object`

The same function, branded as a `MethodProducer`

#### Example

```ts
// Expose a parameterless method
expose({
  clear: asMethod(() => {
    host.value = ''
    textbox.value = ''
    textbox.focus()
  }),
})

// Expose a parameterized method; per-instance state lives in factory scope
let addKey = 0
expose({
  add: asMethod((process?: (item: HTMLElement) => void) => {
    const item = (template.content.cloneNode(true) as DocumentFragment).firstElementChild
    if (item instanceof HTMLElement) {
      item.dataset.key = String(addKey++)
      if (process) process(item)
      container.append(item)
    }
  }),
})
```

#### Since

0.16.2
