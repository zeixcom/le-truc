import type { Signal } from '@zeix/cause-effect';
/** Get the signals map for a component, creating it if needed. */
declare const getSignals: (el: HTMLElement) => Record<string, Signal<any>>;
export { getSignals };
