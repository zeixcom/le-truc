import { type ComputedCallback, type Signal } from '@zeix/cause-effect';
import { type Effects } from './effects';
import { type Parser } from './parsers';
import type { Reader } from './readers';
import { type Helpers, type UI } from './ui';
type ReservedWords = 'constructor' | 'prototype' | '__proto__' | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString';
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>;
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>;
type ComponentSetup<P extends ComponentProps, U extends UI> = (host: Component<P, U>) => Effects<P, U>;
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Parser<P[K]> | Reader<MaybeSignal<P[K]>> | ((host: Component<P, U>) => void);
};
type Component<P extends ComponentProps, U extends UI> = HTMLElement & P & {
    debug?: boolean;
    readonly ui: U;
};
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
/**
 * Define a component with dependency resolution and setup function (connectedCallback)
 *
 * @since 0.15.0
 * @param {string} name - Custom element name
 * @param {function} select - Function to select UI elements
 * @param {object} props - Component properties
 * @param {function} setup - Setup function
 * @throws {InvalidComponentNameError} If component name is invalid
 * @throws {InvalidPropertyNameError} If property name is invalid
 */
declare function component<P extends ComponentProps, U extends UI>(name: string, select?: (helpers: Helpers) => U, props?: Initializers<P, U>, setup?: (host: Component<P, U>) => Effects<P, U>): Component<P, U>;
export { type Component, type ComponentProp, type ComponentProps, type ComponentSetup, type MaybeSignal, type ReservedWords, type Initializers, component, };
