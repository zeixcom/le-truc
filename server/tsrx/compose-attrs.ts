/**
 * Compose-site addressing attributes on a composed element's rendered root
 * (LT-090). `class`/`id` authored on a compose site address the COMPOSE
 * SITE — the child's host element — not typed props (LT-089's discriminator
 * vocabulary): the compose emission filters them out of the forwarded
 * server args and applies them here instead, so the served DOM actually
 * carries the discriminator the client's `first('form-spinbutton.lightness')`
 * selector relies on. A required-overload `first()` throws when nothing
 * matches, so a dropped class is a broken component, not a cosmetic gap.
 *
 * Lives in its own module (imported by generated code through the runtime
 * re-export in `runtime.ts`) because it is markup post-processing, not a
 * signal/expose shim.
 */

import { attr } from './runtime'

/**
 * Splice `attrs` into `markup` immediately after the root open tag of the
 * child component `tag`.
 *
 * `markup` must start with the child's own root open tag — a generated
 * server module's first push is always its root element (ADR 0023
 * sub-design 5's single-root render shape). Anything else is a compiler
 * invariant violation and throws rather than silently dropping the
 * attributes back out of the DOM.
 *
 * Attribute rendering delegates to `attr()` (escaping, nil omission,
 * number coercion). A `class` value merges (token concat) with any class
 * the child root renders itself; today no corpus child does.
 */
export const composeHostAttrs = (
	markup: string,
	tag: string,
	attrs: Record<string, string | number | null | undefined>,
): string => {
	const openTag = `<${tag}`
	const followsTag = markup.charAt(openTag.length)
	const atRoot =
		markup.startsWith(openTag) &&
		(followsTag === '' || ' \t\n\r/>'.includes(followsTag))
	if (!atRoot)
		throw new Error(
			`composeHostAttrs: child markup for ${tag} does not start with its root open tag — compose-site class/id cannot be applied.`,
		)
	const tagClose = markup.indexOf('>')
	if (tagClose < 0)
		throw new Error(
			`composeHostAttrs: malformed child markup for ${tag} — no open-tag end.`,
		)
	let opening = markup.slice(0, tagClose)
	let extra = ''
	for (const [name, value] of Object.entries(attrs)) {
		if (value == null) continue
		if (name === 'class') {
			const merged = mergeClassToken(opening, String(value))
			if (merged != null) {
				opening = merged
				continue
			}
		}
		extra += attr(name, value)
	}
	return opening + extra + markup.slice(tagClose)
}

/**
 * Add one class token to an existing ` class="…"` attribute inside an open
 * tag, or return null when the tag carries no class attribute of its own.
 */
const mergeClassToken = (opening: string, token: string): string | null => {
	const marker = ' class="'
	const start = opening.indexOf(marker)
	if (start < 0) return null
	const valueStart = start + marker.length
	const valueEnd = opening.indexOf('"', valueStart)
	if (valueEnd < 0) return null
	const merged = `${opening.slice(valueStart, valueEnd)} ${token}`.trim()
	return (
		opening.slice(0, valueStart) +
		attr('class', merged) +
		opening.slice(valueEnd + 1)
	)
}
