import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Exported Function === */

/**
 * Effect for setting the text content of an element.
 * Replaces all child nodes (except comments) with a single text node.
 *
 * @since 0.8.0
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the text content
 * @returns {Effect<P, E>} Effect function that sets the text content of the element
 */
const setText = <P extends ComponentProps, E extends Element>(
	reactive: Reactive<string, P, E>,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 't',
		read: el => el.textContent,
		update: (el, value) => {
			Array.from(el.childNodes)
				.filter(node => node.nodeType !== Node.COMMENT_NODE)
				.forEach(node => node.remove())
			el.append(document.createTextNode(value))
		},
	})

export { setText }
