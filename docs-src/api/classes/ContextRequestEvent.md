### Class: ContextRequestEvent\<T\>

Defined in: [src/context.ts:77](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/context.ts#L77)

Class for context-request events

An event fired by a context requester to signal it desires a named context.

A provider should inspect the `context` property of the event to determine if it has a value that can
satisfy the request, calling the `callback` with the requested value if so.

If the requested context event contains a truthy `subscribe` value, then a provider can call the callback
multiple times if the value is changed, if this is the case the provider should pass an `unsubscribe`
function to the callback which requesters can invoke to indicate they no longer wish to receive these updates.

 ContextRequestEvent

#### Extends

- `Event`

#### Type Parameters

##### T

`T` *extends* [`UnknownContext`](../type-aliases/UnknownContext.md)

#### Constructors

##### Constructor

> **new ContextRequestEvent**\<`T`\>(`context`, `callback`, `subscribe?`): `ContextRequestEvent`\<`T`\>

Defined in: [src/context.ts:82](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/context.ts#L82)

###### Parameters

##### context

`T`

##### callback

[`ContextCallback`](../type-aliases/ContextCallback.md)\<[`ContextType`](../type-aliases/ContextType.md)\<`T`\>\>

##### subscribe?

`boolean` = `false`

###### Returns

`ContextRequestEvent`\<`T`\>

###### Overrides

`Event.constructor`

#### Properties

##### AT\_TARGET

> `readonly` **AT\_TARGET**: `2`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11462

###### Inherited from

`Event.AT_TARGET`

***

##### bubbles

> `readonly` **bubbles**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11353

The **`bubbles`** read-only property of the Event interface indicates whether the event bubbles up through the DOM tree or not.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

###### Inherited from

`ContextRequestEvent`.[`bubbles`](#bubbles)

***

##### BUBBLING\_PHASE

> `readonly` **BUBBLING\_PHASE**: `3`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11463

###### Inherited from

`Event.BUBBLING_PHASE`

***

##### callback

> `readonly` **callback**: [`ContextCallback`](../type-aliases/ContextCallback.md)\<[`ContextType`](../type-aliases/ContextType.md)\<`T`\>\>

Defined in: [src/context.ts:79](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/context.ts#L79)

callback function for value getter and unsubscribe function

***

##### cancelable

> `readonly` **cancelable**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11366

The **`cancelable`** read-only property of the Event interface indicates whether the event can be canceled, and therefore prevented as if the event never happened.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

###### Inherited from

`ContextRequestEvent`.[`cancelable`](#cancelable)

***

##### ~~cancelBubble~~

> **cancelBubble**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11360

The **`cancelBubble`** property of the Event interface is deprecated.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

###### Inherited from

`ContextRequestEvent`.[`cancelBubble`](#cancelbubble)

***

##### CAPTURING\_PHASE

> `readonly` **CAPTURING\_PHASE**: `1`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11461

###### Inherited from

`Event.CAPTURING_PHASE`

***

##### composed

> `readonly` **composed**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11372

The read-only **`composed`** property of the or not the event will propagate across the shadow DOM boundary into the standard DOM.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

###### Inherited from

`ContextRequestEvent`.[`composed`](#composed)

***

##### context

> `readonly` **context**: `T`

Defined in: [src/context.ts:78](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/context.ts#L78)

context key

***

##### currentTarget

> `readonly` **currentTarget**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11378

The **`currentTarget`** read-only property of the Event interface identifies the element to which the event handler has been attached.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

###### Inherited from

`ContextRequestEvent`.[`currentTarget`](#currenttarget)

***

##### defaultPrevented

> `readonly` **defaultPrevented**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11384

The **`defaultPrevented`** read-only property of the Event interface returns a boolean value indicating whether or not the call to Event.preventDefault() canceled the event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

###### Inherited from

`ContextRequestEvent`.[`defaultPrevented`](#defaultprevented)

***

##### eventPhase

> `readonly` **eventPhase**: `number`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11390

The **`eventPhase`** read-only property of the being evaluated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

###### Inherited from

`ContextRequestEvent`.[`eventPhase`](#eventphase)

***

##### isTrusted

> `readonly` **isTrusted**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11396

The **`isTrusted`** read-only property of the when the event was generated by the user agent (including via user actions and programmatic methods such as HTMLElement.focus()), and `false` when the event was dispatched via The only exception is the `click` event, which initializes the `isTrusted` property to `false` in user agents.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

###### Inherited from

`ContextRequestEvent`.[`isTrusted`](#istrusted)

***

##### NONE

> `readonly` **NONE**: `0`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11460

###### Inherited from

`Event.NONE`

***

##### ~~returnValue~~

> **returnValue**: `boolean`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11403

The Event property **`returnValue`** indicates whether the default action for this event has been prevented or not.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

###### Inherited from

`ContextRequestEvent`.[`returnValue`](#returnvalue)

***

##### ~~srcElement~~

> `readonly` **srcElement**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11410

The deprecated **`Event.srcElement`** is an alias for the Event.target property.

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

###### Inherited from

`ContextRequestEvent`.[`srcElement`](#srcelement)

***

##### subscribe

> `readonly` **subscribe**: `boolean`

Defined in: [src/context.ts:80](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/context.ts#L80)

whether to subscribe to context changes

***

##### target

> `readonly` **target**: `EventTarget` \| `null`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11416

The read-only **`target`** property of the dispatched.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

###### Inherited from

`ContextRequestEvent`.[`target`](#target)

***

##### timeStamp

> `readonly` **timeStamp**: `number`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11422

The **`timeStamp`** read-only property of the Event interface returns the time (in milliseconds) at which the event was created.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

###### Inherited from

`ContextRequestEvent`.[`timeStamp`](#timestamp)

***

##### type

> `readonly` **type**: `string`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11428

The **`type`** read-only property of the Event interface returns a string containing the event's type.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

###### Inherited from

`ContextRequestEvent`.[`type`](#type)

***

##### AT\_TARGET

> `readonly` `static` **AT\_TARGET**: `2`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11471

###### Inherited from

`Event.AT_TARGET`

***

##### BUBBLING\_PHASE

> `readonly` `static` **BUBBLING\_PHASE**: `3`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11472

###### Inherited from

`Event.BUBBLING_PHASE`

***

##### CAPTURING\_PHASE

> `readonly` `static` **CAPTURING\_PHASE**: `1`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11470

###### Inherited from

`Event.CAPTURING_PHASE`

***

##### NONE

> `readonly` `static` **NONE**: `0`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11469

###### Inherited from

`Event.NONE`

#### Methods

##### composedPath()

###### Call Signature

> **composedPath**(): `EventTarget`[]

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11434

The **`composedPath()`** method of the Event interface returns the event's path which is an array of the objects on which listeners will be invoked.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

##### Returns

`EventTarget`[]

##### Inherited from

`Event.composedPath`

###### Call Signature

> **composedPath**(): \[`EventTarget`?\]

Defined in: node\_modules/bun-types/globals.d.ts:269

Returns an array containing the current EventTarget as the only entry or empty if the event is not being dispatched. This is not used in Node.js and is provided purely for completeness.

##### Returns

\[`EventTarget`?\]

##### Inherited from

`Event.composedPath`

***

##### ~~initEvent()~~

> **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11441

The **`Event.initEvent()`** method is used to initialize the value of an event created using Document.createEvent().

###### Parameters

##### type

`string`

##### bubbles?

`boolean`

##### cancelable?

`boolean`

###### Returns

`void`

###### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

###### Inherited from

`Event.initEvent`

***

##### preventDefault()

###### Call Signature

> **preventDefault**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11447

The **`preventDefault()`** method of the Event interface tells the user agent that if the event does not get explicitly handled, its default action should not be taken as it normally would be.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

###### Call Signature

> **preventDefault**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:279

Sets the `defaultPrevented` property to `true` if `cancelable` is `true`.

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

***

##### stopImmediatePropagation()

###### Call Signature

> **stopImmediatePropagation**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11453

The **`stopImmediatePropagation()`** method of the If several listeners are attached to the same element for the same event type, they are called in the order in which they were added.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

###### Call Signature

> **stopImmediatePropagation**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:285

Stops the invocation of event listeners after the current one completes.

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

***

##### stopPropagation()

###### Call Signature

> **stopPropagation**(): `void`

Defined in: node\_modules/typescript/lib/lib.dom.d.ts:11459

The **`stopPropagation()`** method of the Event interface prevents further propagation of the current event in the capturing and bubbling phases.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`

###### Call Signature

> **stopPropagation**(): `void`

Defined in: node\_modules/bun-types/globals.d.ts:287

This is not used in Node.js and is provided purely for completeness.

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`
