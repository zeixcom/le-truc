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
 * @since 0.11.0
 * @param {Reactive<string, P>} reactive - Reactive value bound to the inner HTML content
 * @param {DangerouslySetInnerHTMLOptions} options - Configuration options: shadowRootMode, allowScripts
 * @returns {Effect<P, E>} Effect function that sets the inner HTML of the element
 */
declare const dangerouslySetInnerHTML: <P extends ComponentProps, E extends Element>(reactive: Reactive<string, P>, options?: DangerouslySetInnerHTMLOptions) => Effect<P, E>;
export { type DangerouslySetInnerHTMLOptions, dangerouslySetInnerHTML };
