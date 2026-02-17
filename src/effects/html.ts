import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'
import { schedule } from '../scheduler'

/* === Types === */

type DangerouslySetInnerHTMLOptions = {
	shadowRootMode?: ShadowRootMode
	allowScripts?: boolean
}

/* === Exported Function === */

/**
 * Effect for setting the inner HTML of an element with optional Shadow DOM support.
 * Provides security options for script execution and shadow root creation.
 *
 * @since 0.11.0
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the inner HTML content
 * @param {DangerouslySetInnerHTMLOptions} options - Configuration options: shadowRootMode, allowScripts
 * @returns {Effect<P, E>} Effect function that sets the inner HTML of the element
 */
const dangerouslySetInnerHTML = <P extends ComponentProps, E extends Element>(
	reactive: Reactive<string, P, E>,
	options: DangerouslySetInnerHTMLOptions = {},
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'h',
		read: el =>
			(el.shadowRoot || !options.shadowRootMode ? el : null)?.innerHTML ?? '',
		update: (el, html) => {
			const { shadowRootMode, allowScripts } = options
			if (!html) {
				if (el.shadowRoot) el.shadowRoot.innerHTML = '<slot></slot>'
				return ''
			}
			if (shadowRootMode && !el.shadowRoot)
				el.attachShadow({ mode: shadowRootMode })
			const target = el.shadowRoot || el
			schedule(el, () => {
				target.innerHTML = html
				if (allowScripts) {
					// allowScripts is the security gate; once opted in, scripts should
					// work correctly. Copy functional and security-hardening attributes
					// but not event handler attributes (e.g. onerror).
					const SCRIPT_ATTRS = [
						'type',
						'src',
						'async',
						'defer',
						'nomodule',
						'crossorigin',
						'integrity',
						'referrerpolicy',
						'fetchpriority',
					]
					target.querySelectorAll('script').forEach(script => {
						const newScript = document.createElement('script')
						for (const attr of SCRIPT_ATTRS) {
							if (script.hasAttribute(attr))
								newScript.setAttribute(attr, script.getAttribute(attr)!)
						}
						// Only set text content for inline scripts (no src attribute)
						if (!script.hasAttribute('src'))
							newScript.appendChild(
								document.createTextNode(script.textContent ?? ''),
							)
						target.appendChild(newScript)
						script.remove()
					})
				}
			})
			return allowScripts ? ' with scripts' : ''
		},
	})

export { type DangerouslySetInnerHTMLOptions, dangerouslySetInnerHTML }
