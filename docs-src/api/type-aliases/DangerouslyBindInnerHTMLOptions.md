### Type Alias: DangerouslyBindInnerHTMLOptions

> **DangerouslyBindInnerHTMLOptions** = `object`

Defined in: [src/bindings.ts:15](https://github.com/zeixcom/le-truc/blob/9c8a9f18dddada370ee9114b563a63d53fc3734c/src/bindings.ts#L15)

#### Properties

##### allowScripts?

> `optional` **allowScripts?**: `boolean`

Defined in: [src/bindings.ts:17](https://github.com/zeixcom/le-truc/blob/9c8a9f18dddada370ee9114b563a63d53fc3734c/src/bindings.ts#L17)

***

##### sanitize?

> `optional` **sanitize?**: (`html`) => `string` \| [`TrustedHTML`](TrustedHTML.md)

Defined in: [src/bindings.ts:37](https://github.com/zeixcom/le-truc/blob/9c8a9f18dddada370ee9114b563a63d53fc3734c/src/bindings.ts#L37)

Optional sanitizer applied to the HTML string before it is assigned to
`innerHTML`. Use this to plug in an external sanitizer (e.g. DOMPurify)
when the content is not fully trusted. Le Truc ships no built-in sanitizer.

May return a plain `string` or a `TrustedHTML` instance. Returning
`TrustedHTML` is required for the assignment to succeed on a page that
enforces `Content-Security-Policy: require-trusted-types-for 'script'` —
the DOM rejects a plain string there, no matter how thoroughly it was
sanitized. DOMPurify configured with `RETURN_TRUSTED_HTML: true` is the
canonical way to produce one. Without a hook that returns `TrustedHTML`,
the assignment throws on such a page; that is the browser's own
enforcement working as intended — the consumer opted into this sink
without producing a trusted value.

Note: sanitizing is the *only* reliable defense against XSS here. Setting
`innerHTML` fires event-handler attributes on non-`<script>` elements
(e.g. `<img onerror>`, `<svg onload>`) even when `allowScripts` is false.

###### Parameters

##### html

`string`

###### Returns

`string` \| [`TrustedHTML`](TrustedHTML.md)

***

##### shadowRootMode?

> `optional` **shadowRootMode?**: `ShadowRootMode`

Defined in: [src/bindings.ts:16](https://github.com/zeixcom/le-truc/blob/9c8a9f18dddada370ee9114b563a63d53fc3734c/src/bindings.ts#L16)
