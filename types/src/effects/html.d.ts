import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
type DangerouslySetInnerHTMLOptions = {
    shadowRootMode?: ShadowRootMode;
    allowScripts?: boolean;
};
/**
 * Effect for setting the inner HTML of an element with optional Shadow DOM support.
 * Provides security options for script execution and shadow root creation.
 *
 * @deprecated Use `run()` with imperative DOM updates in the v1.1 factory form instead.
 * For innerHTML with scheduling, call the effect directly as a thunk:
 * `() => dangerouslySetInnerHTML(reactive, opts)(host as any, element)`.
 * @since 0.11.0
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the inner HTML content
 * @param {DangerouslySetInnerHTMLOptions} options - Configuration options: shadowRootMode, allowScripts
 * @returns {Effect<P, E>} Effect function that sets the inner HTML of the element
 */
declare const dangerouslySetInnerHTML: <P extends ComponentProps, E extends Element>(reactive: Reactive<string, P, E>, options?: DangerouslySetInnerHTMLOptions) => Effect<P, E>;
export { type DangerouslySetInnerHTMLOptions, dangerouslySetInnerHTML };
