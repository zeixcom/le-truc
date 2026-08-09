import type { ComponentExtension } from '../extension';
/**
 * Fire the debug companion effect for one `on()`/`pass()`/`watch()` firing:
 * mark and pulse `element` if attributable, always pulse `host`, and log one
 * `console.debug` entry. No-op unless `isDebugging(host)`.
 */
declare const debugFire: (host: HTMLElement, kind: "on" | "pass" | "watch", element: Element | undefined, value: unknown) => void;
/**
 * Ensure `element` carries its `kind` mark whenever `host` is currently
 * debugging — deliberately mark-only, no pulse or log. `pass()` has no
 * reactive re-run point of its own once `swapSlots()` links its signals
 * directly, so its companion needs a tracked dependency on `host.debug` to
 * mark an already-connected target when `debug` turns on later. But
 * toggling `debug` is not itself a firing: pulsing/logging for every
 * currently-mounted `pass()` the instant `debug` flips on would spam
 * `console.debug` with entries no value change actually produced. Callers
 * combine this (tracked) with a separate `untrack()`-wrapped `debugFire()`
 * call for real firings — see `makePass()`.
 */
declare const markIfDebugging: (host: HTMLElement, element: Element, kind: "on" | "pass" | "watch") => void;
/**
 * `ComponentExtension` adding a reactive `debug: boolean` property (default
 * `false`) to every component, in `DEV_MODE` only. Not exported from the
 * package entry point — see the module doc comment. Syncs `:state(debug)` on
 * the host via `bindState()`, the same custom-state mechanism every other
 * component-owned state already uses, and lazily installs the `metaKey`+click
 * toggle.
 *
 * @since 2.4
 */
declare const debug: () => ComponentExtension;
export { debug, debugFire, markIfDebugging };
