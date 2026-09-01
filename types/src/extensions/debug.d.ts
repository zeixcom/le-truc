import type { ComponentExtension } from '../extension';
/**
 * Fires the debug companion effect for one `on()`/`pass()`/`watch()` firing: marks and pulses
 * `element` if attributable, always pulses `host`, and logs one entry. No-op unless `isDebugging(host)`.
 */
declare const debugFire: (host: HTMLElement, kind: "on" | "pass" | "watch", element: Element | undefined, value: unknown) => void;
/**
 * Ensures `element` carries its `kind` mark whenever `host` is currently debugging — mark-only, no pulse or log.
 * `pass()` has no reactive re-run point of its own once `swapSlots()` links its signals directly, so this gives
 * it a tracked dependency on `host.debug` to mark an already-connected target when `debug` turns on later,
 * without logging a firing that didn't happen. See `makePass()`.
 */
declare const markIfDebugging: (host: HTMLElement, element: Element, kind: "on" | "pass" | "watch") => void;
/**
 * `ComponentExtension` adding a reactive `debug: boolean` property, default `false`, to every
 * component in `DEV_MODE`. Syncs `:state(debug)` on the host via `bindState()` and lazily installs
 * the `metaKey`+click toggle.
 *
 * @since 2.4
 */
declare const debug: () => ComponentExtension;
export { debug, debugFire, markIfDebugging };
