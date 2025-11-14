import { type ComputedCallback, type Signal } from '@zeix/cause-effect';
import { type Effects } from './effects';
import { type Extractor } from './extractors';
import { type Parser } from './parsers';
import { type Helpers, type UI } from './ui';
type ReservedWords = 'constructor' | 'prototype' | '__proto__' | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString';
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>;
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>;
type ComponentUI<P extends ComponentProps, U extends UI> = {
    component: Component<P>;
} & U;
type ComponentSetup<P extends ComponentProps, U extends UI> = (ui: ComponentUI<P, U>, helpers: Helpers<P>) => Effects<P, Component<P>>;
type ComponentConfig<P extends ComponentProps, U extends UI> = {
    name: string;
    select?: (helpers: Helpers<P>) => U;
    props?: P;
    setup?: ComponentSetup<P, U>;
};
type Component<P extends ComponentProps> = HTMLElement & P & {
    debug?: boolean;
};
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
type Initializer<K extends ComponentProp, P extends ComponentProps, U extends UI> = P[K] | Parser<P[K], ComponentUI<P, U>> | Extractor<MaybeSignal<P[K]>, ComponentUI<P, U>> | ((ui: ComponentUI<P, U>) => void);
/**
 * Define a component with dependency resolution and setup function (connectedCallback)
 *
 * @since 0.15.0
 * @param {ComponentConfig<P>} config - Config object for the component
 * @throws {InvalidComponentNameError} If component name is invalid
 * @throws {InvalidPropertyNameError} If property name is invalid
 */
declare function component<P extends ComponentProps, U extends UI>(config: ComponentConfig<P, U>): Component<P>;
export { type Component, type ComponentConfig, type ComponentProp, type ComponentProps, type ComponentSetup, type ComponentUI, type MaybeSignal, type ReservedWords, type Initializer, component, };
