### Function: dangerouslySetInnerHTML()

> **dangerouslySetInnerHTML**\<`P`, `E`\>(`reactive`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/html.ts:23](https://github.com/zeixcom/le-truc/blob/53281ff4634318c8e0964232bafee60d7a1ccdb2/src/effects/html.ts#L23)

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

#### Since

0.11.0
