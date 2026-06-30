### Function: safeSetAttribute()

> **safeSetAttribute**(`element`, `attr`, `value`): `void`

Defined in: [src/bindings.ts:113](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/bindings.ts#L113)

Set an attribute on an element with security validation.

Blocks `on*` event handler attributes and validates URL-like values against
a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).
Violations throw a descriptive error — they are never silent.

#### Parameters

##### element

`Element`

Target element

##### attr

`string`

Attribute name to set

##### value

`string`

Attribute value to set

#### Returns

`void`

#### Since

2.0
