/**
 * Wave-4 migration (LT-104) of the hand-written module-lazyload.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The template renders what module-lazyload.html authors by hand: one
 * `card-callout` holding the loading and error paragraphs, then the hidden
 * `.content` container.
 *
 * The task's state routing stays a hand-written `watch(content, { ok, nil,
 * stale, err })`, not a `<truc:try>` boundary (owner, 2026-09-25). The
 * compiled async boundary cannot express this contract: its ok arm writes
 * escaped `textContent` where this component injects sanitized HTML
 * (`allow-scripts`), it wraps each arm root in a `<fieldset>` that the
 * page-authored instances (the demo, module-listnav, docs) do not carry, its
 * arms are three sibling roots where loading and error share one callout
 * (`.danger` on error), and it has no ok-arm hook for the scroll to the
 * first heading on a later `src` change.
 *
 * Setup is the twin's verbatim, except that `hasLoaded` becomes a field of a
 * const record, because a `let` is outside the setup subset (LTC005).
 */

import {
	asString,
	createTask,
	dangerouslyBindInnerHTML,
	type FactoryContext,
	query,
	schedule,
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
 * @attribute {boolean} [allow-scripts=false] - Permit inline scripts in the fetched content. Presence-only; read once at connect time.
 * @demo {https://zeixcom.github.io/le-truc/examples.html#module-lazyload} Interactive preview and usage examples
 **/
export function ModuleLazyload(
	{
		src,
		allowScripts = false,
		loading = 'Loading...',
	}: {
		src?: string
		allowScripts?: boolean
		/** The loading message shown until the partial resolves. */
		loading?: string
		/**
		 * Compiler-consumed compose surface (truc:pass), never a render arg:
		 * module-listnav passes its listbox's value into `src`.
		 */
		'truc:pass'?: { src?: () => string }
	},
	{ expose, first, host, watch }: FactoryContext<ModuleLazyloadProps>,
) {
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

	const setHTML = dangerouslyBindInnerHTML(contentEl, {
		allowScripts: host.hasAttribute('allow-scripts'),
	}).ok

	expose({ src: asString() })

	// Skip the scroll-to-heading on the very first load, so the page
	// doesn't jump on initial mount — only on subsequent src changes.
	const load = { hasLoaded: false }
	// Distinct key from `contentEl` (used by dangerouslyBindInnerHTML above)
	// so this scroll task doesn't clobber the pending innerHTML write.
	const scrollTask = {}

	const callout = first(
		'card-callout',
		'Needed to display loading state and error messages.',
	)
	const loadingEl = first('.loading', 'Needed to display loading state.')
	const errorEl = first('.error', 'Needed to display error messages.')
	watch(content, {
		ok: content => {
			callout.hidden = true
			loadingEl.hidden = true
			contentEl.hidden = false
			setHTML(content)

			if (load.hasLoaded) {
				schedule(scrollTask, () => {
					query(contentEl, 'h1, h2, h3, h4, h5, h6')?.scrollIntoView({
						behavior: 'smooth',
						block: 'start',
					})
				})
			}
			load.hasLoaded = true
		},
		nil: () => {
			callout.hidden = false
			loadingEl.hidden = false
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
			loadingEl.hidden = true
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

	return (
		<>
			<module-lazyload src={src} allow-scripts={allowScripts}>
				<card-callout>
					<p class="loading" role="status">
						{loading}
					</p>
					<p class="error" role="alert" aria-live="assertive" hidden></p>
				</card-callout>
				<div class="content" hidden></div>
			</module-lazyload>
			<style>{css`
module-lazyload {
	display: block;
}
`}</style>
		</>
	)
}
