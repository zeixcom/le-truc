### Function: throttle()

> **throttle**\<`T`\>(`fn`, `signal?`): `T` & `object`

Defined in: [src/scheduler.ts:69](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/scheduler.ts#L69)

Throttle a function to execute at most once per animation frame, always
using the latest arguments. Shares the same RAF tick as `schedule()`.

Use this to throttle high-frequency event handlers at the input level,
preventing unnecessary churn in the signal graph between frames.

The returned function has a `.cancel()` method that discards any pending
invocation — call it during cleanup to avoid stale callbacks after
an element disconnects.

#### Type Parameters

##### T

`T` *extends* (...`args`) => `void`

#### Parameters

##### fn

`T`

Function to throttle

##### signal?

`AbortSignal`

Optional signal; when aborted, cancels any pending invocation

#### Returns

`T` & `object`

Throttled function with a `.cancel()` method

#### Since

2.0.0
