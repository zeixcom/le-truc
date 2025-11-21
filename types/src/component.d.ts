import { type ComputedCallback, type Signal } from '@zeix/cause-effect';
import { type Effects } from './effects';
import { type Parser } from './parsers';
import { type ElementQueries, type UI } from './ui';
type ReservedWords = 'constructor' | 'prototype' | '__proto__' | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString';
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>;
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>;
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
    component: Component<P>;
};
type ComponentSetup<P extends ComponentProps, U extends UI> = (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>;
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K], ComponentUI<P, U>> | ((ui: ComponentUI<P, U>) => MaybeSignal<P[K]> | void);
};
type Component<P extends ComponentProps> = HTMLElement & P;
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
/**
 * Define a component with dependency resolution and setup function (connectedCallback)
 *
 * @since 0.15.0
 * @param {string} name - Custom element name
 * @param {object} props - Component properties
 * @param {function} select - Function to select UI elements
 * @param {function} setup - Setup function
 * @throws {InvalidComponentNameError} If component name is invalid
 * @throws {InvalidPropertyNameError} If property name is invalid
 */
declare function component<P extends ComponentProps, U extends UI = {}>(name: string, props?: Initializers<P, U>, select?: (helpers: ElementQueries) => U, setup?: (ui: ComponentUI<P, U>) => Effects<P, U>): Component<P>;
export { type Component, type ComponentProp, type ComponentProps, type ComponentUI, type ComponentSetup, type MaybeSignal, type ReservedWords, type Initializers, component, };
