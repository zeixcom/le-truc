import { type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import { type Effects } from './effects';
import { type Parser, type Reader } from './parsers';
import { type ElementQueries, type UI } from './ui';
type ReservedWords = 'constructor' | 'prototype' | '__proto__' | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString';
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>;
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>;
type Component<P extends ComponentProps> = HTMLElement & P;
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
    host: Component<P>;
};
type ComponentSetup<P extends ComponentProps, U extends UI> = (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>;
type MethodProducer<P extends ComponentProps, U extends UI> = (ui: U & {
    host: Component<P>;
}) => void;
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K], ComponentUI<P, U>> | Reader<MaybeSignal<P[K]>, ComponentUI<P, U>> | MethodProducer<P, ComponentUI<P, U>>;
};
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T>;
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
declare function defineComponent<P extends ComponentProps, U extends UI = {}>(name: string, props?: Initializers<P, U>, select?: (elementQueries: ElementQueries) => U, setup?: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>): Component<P>;
export { defineComponent, type Component, type ComponentProp, type ComponentProps, type ComponentSetup, type ComponentUI, type Initializers, type MaybeSignal, type ReservedWords, };
