[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createTask

# Function: createTask()

## Name

Le Truc

## Version

0.16.0

## Author

Esther Brunner

## Call Signature

> **createTask**\<`T`\>(`fn`, `options`): [`Task`](../type-aliases/Task.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:67

Creates an asynchronous reactive computation (colorless async).
The computation automatically tracks dependencies and re-executes when they change.
Provides abort semantics - in-flight computations are aborted when dependencies change.

### Type Parameters

#### T

`T` *extends* `object`

The type of value resolved by the task

### Parameters

#### fn

(`prev`, `signal`) => `Promise`\<`T`\>

The async computation function that receives the previous value and an AbortSignal

#### options

[`SignalOptions`](../type-aliases/SignalOptions.md)\<`T`\> & `object` & `object`

Optional configuration for the task

### Returns

[`Task`](../type-aliases/Task.md)\<`T`\>

A Task object with get(), isPending(), and abort() methods

### Since

0.18.0

### Examples

```ts
const userId = createState(1);
const user = createTask(async (prev, signal) => {
  const response = await fetch(`/api/users/${userId.get()}`, { signal });
  return response.json();
});

// When userId changes, the previous fetch is aborted
userId.set(2);
```

```ts
// Check pending state
if (user.isPending()) {
  console.log('Loading...');
}
```

## Call Signature

> **createTask**\<`T`\>(`fn`, `options?`): [`Task`](../type-aliases/Task.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/task.d.ts:70

Creates an asynchronous reactive computation (colorless async).
The computation automatically tracks dependencies and re-executes when they change.
Provides abort semantics - in-flight computations are aborted when dependencies change.

### Type Parameters

#### T

`T` *extends* `object`

The type of value resolved by the task

### Parameters

#### fn

[`TaskCallback`](../type-aliases/TaskCallback.md)\<`T`\>

The async computation function that receives the previous value and an AbortSignal

#### options?

[`ComputedOptions`](../type-aliases/ComputedOptions.md)\<`T`\>

Optional configuration for the task

### Returns

[`Task`](../type-aliases/Task.md)\<`T`\>

A Task object with get(), isPending(), and abort() methods

### Since

0.18.0

### Examples

```ts
const userId = createState(1);
const user = createTask(async (prev, signal) => {
  const response = await fetch(`/api/users/${userId.get()}`, { signal });
  return response.json();
});

// When userId changes, the previous fetch is aborted
userId.set(2);
```

```ts
// Check pending state
if (user.isPending()) {
  console.log('Loading...');
}
```
