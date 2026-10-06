/**
 * Wave-4 migration (LT-104) of the hand-written module-lazyload.ts, which
 * stays beside this source as the variant set's `.ts` twin (ADR 0039). Every
 * member declares its own `HTMLElementTagNameMap` entry (s4).
 *
 * The task's state routing is the compiled async boundary (LT-449, ruling in
 * LT-334): `<truc:try>` with per-arm callouts — loading and error are
 * separate arms, `.danger` authored on the catch arm's own callout, so the
 * shared-callout `hidden` toggling of the twin is gone and, when ok, no
 * callout exists in the DOM at all. The ok arm reads its value through the
 * reactive `truc:html` thunk (the sanitized channel, LT-025 — the compiled
 * surface strips scripts; `allow-scripts` stays a page-authorable but inert
 * attribute until LT-448's design lands). The in-flight dim during a
 * re-fetch is the reactive `isPending` idiom on the ok arm root; the
 * scroll-to-first-heading on a later `src` change stays a sanctioned
 * beside-watch — arm-mounted effects die with the arm, and the hasLoaded
 * guard is component-lifetime state.
 */

import {
	asString,
	createTask,
	type FactoryContext,
	isPending,
	query,
	schedule,
} from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
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
 * @attribute {boolean} [allow-scripts=false] - Permit inline scripts in the fetched content. Presence-only; read once at connect time. Inert on the compiled surface, which sanitises through `truc:html` (scripts stripped) pending the script-loading design (LT-448).
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
	{ expose, host, watch }: FactoryContext<ModuleLazyloadProps>,
) {
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
	// The scheduled task runs after the boundary's reconcile has adopted
	// the ok arm and its html watch has written the content (LT-449's
	// ordering probe pins this).
	const load = { hasLoaded: false }
	// Distinct key from any element-scoped scheduled task, so the scroll
	// cannot clobber a pending content write.
	const scrollTask = {}

	watch(content, {
		ok: () => {
			if (load.hasLoaded) {
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
			load.hasLoaded = true
		},
	})

	return (
		<module-lazyload src={src} allow-scripts={allowScripts}>
			<truc:try
				pending={
					<card-callout>
						<p class="loading" role="status">
							{loading}
						</p>
					</card-callout>
				}
				catch={error => (
					<card-callout class="danger">
						<p class="error" role="alert" aria-live="assertive">
							{error.message}
						</p>
					</card-callout>
				)}
			>
				<div
					class="content"
					style={() => ({
						opacity: isPending(content) ? 'var(--opacity-dimmed)' : null,
					})}
					truc:html={() => content.get()}
				></div>
			</truc:try>
			<style>{css`
:host {
	display: block;
}`}</style>
		</module-lazyload>
	)
}
