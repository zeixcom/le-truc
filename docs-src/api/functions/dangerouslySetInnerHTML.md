### ~~Function: dangerouslySetInnerHTML()~~

> **dangerouslySetInnerHTML**\<`P`, `E`\>(`reactive`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/html.ts:26](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/effects/html.ts#L26)

Effect for setting the inner HTML of an element with optional Shadow DOM support.
Provides security options for script execution and shadow root creation.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element`

#### Parameters

##### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`string`, `P`, `E`\>

Reactive value bound to the inner HTML content

##### options?

[`DangerouslySetInnerHTMLOptions`](../type-aliases/DangerouslySetInnerHTMLOptions.md) = `{}`

Configuration options: shadowRootMode, allowScripts

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the inner HTML of the element

#### Deprecated

Use `watch()` with imperative DOM updates in the v1.1 factory form instead.
For innerHTML with scheduling, call the effect directly as a thunk:
`() => dangerouslySetInnerHTML(reactive, opts)(host as any, element)`.

#### Since

0.11.0
