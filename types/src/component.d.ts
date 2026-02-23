import { type MaybeCleanup, type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
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
}) => MaybeCleanup;
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K], ComponentUI<P, U>> | Reader<MaybeSignal<P[K]>, ComponentUI<P, U>> | MethodProducer<P, ComponentUI<P, U>>;
};
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T>;
/**
 * Define and register a reactive custom element.
 *
 * Calls `customElements.define()` and returns the registered class.
 * Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.
 *
 * @since 0.15.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {Initializers<P, U>} props - Initializers for reactive properties: static values, signals, parsers, or readers
 * @param {function} select - Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)
 * @param {function} setup - Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 * @throws {InvalidPropertyNameError} If a property name conflicts with reserved words or inherited HTMLElement properties
 */
declare function defineComponent<P extends ComponentProps, U extends UI = {}>(name: string, props?: Initializers<P, U>, select?: (elementQueries: ElementQueries) => U, setup?: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>): Component<P>;
export { defineComponent, type Component, type ComponentProp, type ComponentProps, type ComponentSetup, type ComponentUI, type Initializers, type MethodProducer, type MaybeSignal, type ReservedWords, };
