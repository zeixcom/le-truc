import { isString } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import {
	getFallback,
	isParser,
	type Parser,
	type ParserOrFallback,
} from './parsers'
import type { UI } from './ui'

/* === Types === */

type Reader<T extends {}> = <E extends Element = HTMLElement>(target: E) => T

type ComponentReader<T extends {}> = <P extends ComponentProps, U extends UI>(
	host: Component<P, U>,
) => T

type LooseReader<T> = <E extends Element = HTMLElement>(
	target: E,
) => T | null | undefined

type Fallback<T extends {}> = T | Reader<T> | ComponentReader<T>

/* === Exported Functions === */

/**
 * Get a value from elements in the DOM
 *
 * @since 0.15.0
 * @param {R} readers - An object of reader functions for UI elements as keys to get a value from
 * @param {ParserOrFallback<T>} fallback - Fallback value or parser function
 * @returns {Reader<T>} Loose reader function to apply to the host element
 */
const read =
	<T extends {}>(
		readers: Record<string, LooseReader<T | string>>,
		fallback: ParserOrFallback<T>,
	): ComponentReader<T> =>
	<P extends ComponentProps, U extends UI>(host: Component<P, U>): T => {
		let value: T | string | null | undefined = undefined
		for (const [key, reader] of Object.entries(readers)) {
			if (!reader) continue
			const element = Array.isArray(host.ui[key])
				? host.ui[key][0]
				: host.ui[key]
			if (!element) continue
			value = reader(element)
			if (value != null) break
		}
		return isString(value) && isParser<T>(fallback)
			? (fallback as Parser<T>)(host, value)
			: ((value as T) ?? getFallback(host, fallback))
	}

const getText = (): LooseReader<string> => (element: Element) =>
	element.textContent?.trim()

const getIdrefText =
	(attr: string): LooseReader<string> =>
	(element: Element) => {
		const id = element.getAttribute(attr)
		return id ? document.getElementById(id)?.textContent?.trim() : undefined
	}

const getProperty =
	<K extends string>(prop: K) =>
	<E extends Element>(element: E): K extends keyof E ? E[K] : undefined =>
		(element as any)[prop]

const hasAttribute =
	(attr: string): Reader<boolean> =>
	(element: Element) =>
		element.hasAttribute(attr)

const getAttribute =
	(attr: string): LooseReader<string> =>
	<E extends Element = Element>(element: E) =>
		element.getAttribute(attr)

const hasClass =
	(token: string): Reader<boolean> =>
	(element: Element) =>
		element.classList.contains(token)

const getStyle =
	(prop: string): Reader<string> =>
	(element: Element) =>
		window.getComputedStyle(element).getPropertyValue(prop)

export {
	type Reader,
	type Fallback,
	type LooseReader,
	read,
	getText,
	getIdrefText,
	getProperty,
	hasAttribute,
	getAttribute,
	hasClass,
	getStyle,
}
