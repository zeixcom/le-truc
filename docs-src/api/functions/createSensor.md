### Function: createSensor()

> **createSensor**\<`T`\>(`watched`, `options?`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:80

Creates a sensor that tracks external input and updates a state value as long as it is active.
Sensors get activated when they are first accessed by an effect and deactivated when they are
no longer watched. This lazy activation pattern ensures resources are only consumed when needed.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value produced by the sensor

#### Parameters

##### watched

`SensorCallback`\<`T`\>

The callback invoked when the sensor starts being watched, receives a `set` function and returns a cleanup function.

##### options?

[`SensorOptions`](../type-aliases/SensorOptions.md)\<`T`\>

Optional configuration for the sensor.

#### Returns

[`Sensor`](../type-aliases/Sensor.md)\<`T`\>

A read-only sensor signal.

#### Since

0.18.0

#### Examples

**Tracking external values**

```ts
// An initial `value` avoids UnsetSignalValueError on the first read,
// before any mousemove event has fired.
const mousePos = createSensor<{ x: number; y: number }>((set) => {
  const handler = (e: MouseEvent) => {
    set({ x: e.clientX, y: e.clientY });
  };
  window.addEventListener('mousemove', handler);
  return () => window.removeEventListener('mousemove', handler);
}, { value: { x: 0, y: 0 } });
```

**Observing a mutable object**

```ts
import { createSensor, SKIP_EQUALITY } from 'cause-effect';

const el = createSensor<HTMLElement>((set) => {
  const node = document.getElementById('box')!;
  set(node);
  const obs = new MutationObserver(() => set(node));
  obs.observe(node, { attributes: true });
  return () => obs.disconnect();
}, { value: node, equals: SKIP_EQUALITY });
```
