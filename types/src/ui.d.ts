import type { MaybeCleanup } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import { type Effects } from './effects';
type ExtractTag<S extends string> = S extends `${infer T}.${string}` ? T : S extends `${infer T}#${string}` ? T : S extends `${infer T}:${string}` ? T : S extends `${infer T}[${string}` ? T : S;
type KnownTag<S extends string> = Lowercase<ExtractTag<S>> extends keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | keyof MathMLElementTagNameMap ? Lowercase<ExtractTag<S>> : never;
type ElementFromSelector<S extends string> = KnownTag<S> extends never ? HTMLElement : KnownTag<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[KnownTag<S>] : KnownTag<S> extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[KnownTag<S>] : HTMLElement;
type ElementUsage = {
    <S extends string>(selector: S, required: string): ElementFromSelector<S>;
    <S extends string>(selector: S): ElementFromSelector<S> | null;
    <E extends Element>(selector: string, required: string): E;
    <E extends Element>(selector: string): E | null;
};
type ElementsUsage = {
    <S extends string>(selector: S, required?: string): ElementFromSelector<S>[];
    <E extends Element>(selector: string, required?: string): E[];
};
type UI = Record<string, ElementUsage | ElementsUsage>;
type ElementEffects<P extends ComponentProps> = {
    <S extends string>(selector: S, effects: Effects<P, ElementFromSelector<S>>, required?: string): () => MaybeCleanup;
    <E extends Element>(selector: string, effects: Effects<P, E>, required?: string): () => MaybeCleanup;
};
type Helpers<P extends ComponentProps> = {
    useElement: ElementUsage;
    useElements: ElementsUsage;
    first: ElementEffects<P>;
    all: ElementEffects<P>;
};
/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {Component<P>} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
declare const getHelpers: <P extends ComponentProps>(host: Component<P>) => [Helpers<P>, () => string[]];
export { type Helpers, getHelpers, type UI };
