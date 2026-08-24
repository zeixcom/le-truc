/**
 * Isomorphic-format migration: card-mediaqueries — a context consumer
 * demonstrating `requestContext()` (LT-035, ADR 0024 sub-design 15).
 *
 * Deviation from the hand-written `card-mediaqueries.ts`: the original is a
 * light-DOM ENHANCER, not a template owner — it queries pre-existing
 * `.motion`/`.theme`/`.viewport`/`.orientation` elements the PAGE AUTHOR
 * supplies as light DOM (see the demo `.html`, which writes its own
 * `<h5>`/`<dl>` structure inside `<card-mediaqueries>`), then binds text
 * into whichever of those elements exist (each guarded independently via
 * `first()`'s "maybe" cardinality). TSRX's single canonical template can't
 * express "enhance arbitrary author-supplied light DOM" any more than it
 * could for `card-blogmeta` (NOTES.md) — there's no prop to convert
 * usage-site markup to. This migration instead makes the component OWN its
 * template: a `label` prop replaces the page author's own `<h5>` heading,
 * and all four `<dd>` slots are unconditionally rendered (no more per-slot
 * "maybe" queries) — a real behavior change, not just a source-of-truth
 * swap. Flagged in NOTES.md for the demo `.html`/e2e-spec follow-up this
 * implies (the existing spec relies on dynamically injecting a fresh
 * `.motion`/`.theme`/etc. light-DOM subtree at runtime, which this shape no
 * longer supports).
 */
import {
	MEDIA_MOTION,
	MEDIA_ORIENTATION,
	MEDIA_THEME,
	MEDIA_VIEWPORT,
} from '../../context/media/context-media.ts'

export type CardMediaqueriesProps = {
	/** Heading text above the preference list. */
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'card-mediaqueries': HTMLElement & CardMediaqueriesProps
	}
}

/**
 * Displays the current OS-level media query preferences (motion, theme, viewport, orientation).
 * Use it to visualise the context values that `context-media` provides — the labels
 * update when the user changes their OS or browser preferences.
 * This component should be placed inside a `<context-media>` provider ancestor;
 * without a provider, context values fall back to `"unknown"`.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#card-mediaqueries} Interactive preview and usage examples
 **/
export function CardMediaqueries({ label }: { label?: string })
	@{
		const motion = requestContext(MEDIA_MOTION, 'unknown')
		const theme = requestContext(MEDIA_THEME, 'unknown')
		const viewport = requestContext(MEDIA_VIEWPORT, 'unknown')
		const orientation = requestContext(MEDIA_ORIENTATION, 'unknown')

		<>
			<card-mediaqueries>
				@if (label) {
					<h5>{label}</h5>
				}
				<dl>
					<dt>Motion Preference:</dt>
					<dd class="motion">&{motion}</dd>
					<dt>Theme Preference:</dt>
					<dd class="theme">&{theme}</dd>
					<dt>Device Viewport:</dt>
					<dd class="viewport">&{viewport}</dd>
					<dt>Device Orientation:</dt>
					<dd class="orientation">&{orientation}</dd>
				</dl>
			</card-mediaqueries>

			<style>
			card-mediaqueries {
				display: block;
				margin: 0 0 var(--space-l);

				& h5 {
					margin: 0 0 var(--space-s);
				}

				& dl {
					display: grid;
					grid-template-columns: auto 1fr;
					gap: var(--space-xs) var(--space-s);
					margin: 0;
				}

				& dt {
					font-weight: var(--font-weight-bold);
				}

				& dd {
					margin: 0;
					color: var(--color-text-soft);
				}
			}
			</style>
		</>
	}
