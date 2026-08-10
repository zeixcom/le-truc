import {
	asString,
	createTask,
	dangerouslyBindInnerHTML,
	defineComponent,
	query,
	schedule,
} from '../../../index'
import {
	fetchWithCache,
	isRecursiveURL,
	isValidURL,
} from '../../_common/fetchWithCache'

export type ModuleLazyloadProps = {
	/** URL of the HTML partial to fetch and render. Read from the `src` attribute at connect time. */
	src: string
}

declare global {
	interface HTMLElementTagNameMap {
		'module-lazyload': HTMLElement & ModuleLazyloadProps
	}
}

/**
 * Fetches and renders an HTML partial from a URL, with loading and error states.
 * Use it for lazy-loading content on demand — the `src` attribute should point to a
 * same-origin URL; cross-origin or `javascript:` URLs are rejected for security.
 * Untrusted HTML must be sanitised server-side; set `allow-scripts` only when required.
 * @attribute {boolean} [allow-scripts=false] - Permit inline scripts in the fetched content. Presence-only; read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-lazyload} Interactive preview and usage examples
 **/
export default defineComponent<ModuleLazyloadProps>(
	'module-lazyload',
	({ expose, first, host, watch }) => {
		const contentEl = first('.content', 'Needed to display content.')

		const content = createTask<string>(async (_prev, abort) => {
			const url = host.src
			if (!url) throw new Error('No URL provided')
			if (!isValidURL(url)) throw new Error('Invalid URL')
			if (isRecursiveURL(url, host)) throw new Error('Recursive URL detected')
			try {
				const { content: fetched } = await fetchWithCache(url, abort)
				return fetched
			} catch (e) {
				throw new Error(`Failed to fetch content for "${url}": ${String(e)}`)
			}
		})

		const { ok: setHTML } = dangerouslyBindInnerHTML(contentEl, {
			allowScripts: host.hasAttribute('allow-scripts'),
		})

		expose({ src: asString() })

		// Skip the scroll-to-heading on the very first load, so the page
		// doesn't jump on initial mount — only on subsequent src changes.
		let hasLoaded = false
		// Distinct key from `contentEl` (used by dangerouslyBindInnerHTML above)
		// so this scroll task doesn't clobber the pending innerHTML write.
		const scrollTask = {}

		const callout = first(
			'card-callout',
			'Needed to display loading state and error messages.',
		)
		const loading = first('.loading', 'Needed to display loading state.')
		const errorEl = first('.error', 'Needed to display error messages.')
		watch(content, {
			ok: content => {
				callout.hidden = true
				loading.hidden = true
				contentEl.hidden = false
				setHTML(content)

				if (hasLoaded) {
					schedule(scrollTask, () => {
						query(contentEl, 'h1, h2, h3, h4, h5, h6')?.scrollIntoView({
							behavior: 'smooth',
							block: 'start',
						})
					})
				}
				hasLoaded = true
			},
			nil: () => {
				callout.hidden = false
				loading.hidden = false
				contentEl.hidden = true
			},
			stale: () => {
				contentEl.style.setProperty('opacity', 'var(--opacity-dimmed)')
				return () => {
					contentEl.style.removeProperty('opacity')
				}
			},
			err: error => {
				callout.hidden = false
				callout.classList.add('danger')
				loading.hidden = true
				errorEl.hidden = false
				errorEl.textContent = error.message
				contentEl.hidden = true
				return () => {
					callout.classList.remove('danger')
					errorEl.hidden = true
					errorEl.textContent = ''
				}
			},
		})
	},
)
