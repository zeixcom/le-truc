import {
	asString,
	bindStyle,
	bindText,
	createTask,
	dangerouslyBindInnerHTML,
	defineComponent,
	isPending,
	query,
	reconcile,
	sanitizeHtml,
	schedule,
	UnsetSignalValueError,
} from '@zeix/le-truc'
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
 *
 * The hand-written spelling of the compiled `<truc:try>` boundary (LT-449):
 * the page carries one live arm root plus one inert
 * `<template data-arms data-key>` per arm (`ok`, `nil`, `err`), and
 * `reconcile()` swaps arms by key — pending (`nil`) while the task has no
 * value, `err` when it rejects, `ok` otherwise. Each arm's effects mount in
 * the arm callback and die with the arm.
 * @attribute {boolean} [allow-scripts=false] - Permit inline scripts in the fetched content. Presence-only; read once at connect time. Inert while the content is written through the configured `sanitizeHtml` (scripts stripped), pending the script-loading design (LT-448).
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-lazyload} Interactive preview and usage examples
 **/
export default defineComponent<ModuleLazyloadProps>(
	'module-lazyload',
	({ expose, host, watch }) => {
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

		expose({ src: asString() })

		// Skip the scroll-to-heading on the very first load, so the page
		// doesn't jump on initial mount — only on subsequent src changes.
		// Component-lifetime state, so it lives here, not in the ok arm.
		let hasLoaded = false
		// Distinct key from any element-scoped scheduled task, so the scroll
		// cannot clobber a pending content write.
		const scrollTask = {}

		watch(content, {
			ok: () => {
				if (hasLoaded) {
					schedule(scrollTask, () => {
						query(
							host,
							'.content h1, .content h2, .content h3, .content h4, .content h5, .content h6',
						)?.scrollIntoView({
							behavior: 'smooth',
							block: 'start',
						})
					})
				}
				hasLoaded = true
			},
		})

		reconcile(
			host,
			host.querySelectorAll<HTMLTemplateElement>(
				':scope > template[data-arms]',
			),
			() => {
				try {
					content.get()
				} catch (error) {
					return error instanceof UnsetSignalValueError ? 'nil' : 'err'
				}
				return 'ok'
			},
			(armElement, armKey, first) => {
				if (armKey === 'ok') {
					// Dim the retained content while a re-fetch is in flight.
					watch(
						() => (isPending(content) ? 'var(--opacity-dimmed)' : null),
						bindStyle(armElement, 'opacity'),
					)
					watch(
						() => content.get(),
						dangerouslyBindInnerHTML(armElement, { sanitize: sanitizeHtml }),
					)
				} else if (armKey === 'err') {
					const errorEl = first('.error', 'Needed to display error messages.')
					watch(content, {
						ok: () => {},
						err: error => bindText(errorEl)(error.message),
					})
				}
			},
		)
	},
)
