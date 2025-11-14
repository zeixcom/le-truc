import type { ComponentProps, ComponentUI } from './component';
import type { UI } from './ui';
type Parser<T extends {}, P extends ComponentProps = ComponentProps, U extends UI = UI> = (ui: ComponentUI<P, U>, value: string | null | undefined, old?: string | null) => T;
/**
 * Check if a value is a string parser
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a string parser
 * @returns {boolean} True if the value is a string parser, false otherwise
 */
declare const isParser: <T extends {}, P extends ComponentProps = ComponentProps, U extends UI = UI>(value: unknown) => value is Parser<T, P, U>;
export { type Parser, isParser };
