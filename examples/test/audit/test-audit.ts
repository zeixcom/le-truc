/**
 * Audit-fix test components.
 *
 * These minimal components exist solely to exercise the three High-severity
 * fixes from AUDIT_REPORT.md in Playwright. They are not example components
 * and are not rendered in the docs.
 *
 * - audit-reserved-word: exposes a reserved property name via a cast; the
 *   runtime guard in #initSignals must throw InvalidPropertyNameError on connect.
 * - audit-reconnect: a component with an on() listener, used to verify that
 *   reparenting (disconnect → reconnect) does not accumulate listeners.
 * - audit-sanitize: uses dangerouslyBindInnerHTML with a sanitize hook, to
 *   verify the hook strips a non-`<script>` XSS vector.
 * - audit-trusted-html / audit-dompurify: verify the sanitize hook's
 *   TrustedHTML support under Trusted-Types enforcement — the former via a
 *   native `trustedTypes` policy, the latter via real DOMPurify, the
 *   integration the library's own docs recommend.
 */

import DOMPurify from 'dompurify'
import {
	type ComponentProps,
	dangerouslyBindInnerHTML,
	defineComponent,
} from '../../../index'

/* === Reserved-word runtime guard === */
//
// A consumer that defeats the type-level ReservedWords exclusion (e.g. via an
// asJSON-parsed key or a Record<string, …> cast) reaches #initSignals. The
// runtime isReservedWord guard must throw InvalidPropertyNameError before
// Object.defineProperty corrupts the host.

type ReservedProps = Record<string, unknown> & ComponentProps

defineComponent<ReservedProps>('audit-reserved-word', ({ expose }) => {
	// `constructor` is a ReservedWord — normally rejected by the type system.
	// The cast simulates an untyped/JSON-driven prop reaching the runtime.
	expose({ constructor: 'blocked' } as unknown as { constructor: string })
})

/* === Reconnect listener accounting === */
//
// A component with an on() listener on a child element. The spec reparents the
// host N times and asserts the listener count stays bounded (the fix runs the
// previous cleanup before re-activating #setup on reconnect).

type ReconnectProps = {
	value: number
}

declare global {
	interface HTMLElementTagNameMap {
		'audit-reconnect': HTMLElement & ReconnectProps
	}
}

defineComponent<ReconnectProps>(
	'audit-reconnect',
	({ expose, first, host, on }) => {
		const btn = first('button') as HTMLButtonElement
		expose({ value: 0 })
		// Each click increments value by 1. If the reconnect-leak bug is present,
		// every reparent cycle adds another listener on the same button, so a single
		// click increments by N (one per accumulated listener) instead of 1.
		on(btn, 'click', () => ({ value: host.value + 1 }))
	},
)

/* === dangerouslyBindInnerHTML sanitize hook === */
//
// Uses dangerouslyBindInnerHTML with a sanitize hook that strips on* attributes
// from all elements. The spec injects a payload with an <img onerror> vector and
// asserts the hook removed it (proving the hook is the supported XSS defense).

type SanitizeProps = {
	content: string
}

declare global {
	interface HTMLElementTagNameMap {
		'audit-sanitize': HTMLElement & SanitizeProps
	}
}

// Minimal on*-attribute stripper (the library ships no sanitizer; this stands in
// for DOMPurify to exercise the sanitize hook contract). Repeats to a fixed point
// so a partial strip can't leave behind a reformed on*-attribute.
const stripEventHandlers = (html: string): string => {
	let current = html
	let previous: string
	do {
		previous = current
		current = previous.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
	} while (current !== previous)
	return current
}

defineComponent<SanitizeProps>('audit-sanitize', ({ expose, first, watch }) => {
	const target = first('[data-target]', 'required')
	expose({ content: '' })
	watch(
		'content',
		dangerouslyBindInnerHTML(target, { sanitize: stripEventHandlers }),
	)
})

/* === Trusted Types compliance via the sanitize hook === */
//
// On a page enforcing `Content-Security-Policy: require-trusted-types-for
// 'script'`, an innerHTML assignment throws unless the value is a TrustedHTML
// instance — a sanitize hook that returns a plain string (like the one above)
// does not satisfy this, however thoroughly it sanitized. audit-trusted-html
// wraps the same on*-stripper in a real TrustedHTML via a native Trusted Types
// policy, standing in for DOMPurify configured with RETURN_TRUSTED_TYPE: true
// (exercised for real, with the actual library, by audit-dompurify below).

type TrustedHTMLProps = {
	content: string
}

// `trustedTypes` is not yet part of this project's `lib.dom.d.ts`; declare the
// minimal shape used here. Kept as `object`, not a structural mirror, same as
// Le Truc's own internal (unexported) `TrustedHTML` in src/bindings.ts — see
// ADR-0010's amendments for why a real TrustedHTML can't be modeled as
// `{ toJSON(): string }` (it's a nominal, members-private type by design).
type TrustedHTML = object

declare global {
	interface HTMLElementTagNameMap {
		'audit-trusted-html': HTMLElement & TrustedHTMLProps
	}
	interface Window {
		trustedTypes?: {
			createPolicy: (
				name: string,
				rules: { createHTML: (html: string) => string },
			) => { createHTML: (html: string) => TrustedHTML }
		}
	}
}

const trustedTypesPolicy = window.trustedTypes?.createPolicy(
	'audit-trusted-html',
	{ createHTML: stripEventHandlers },
)

const sanitizeToTrustedHTML = (html: string): string | TrustedHTML =>
	trustedTypesPolicy
		? trustedTypesPolicy.createHTML(html)
		: stripEventHandlers(html)

defineComponent<TrustedHTMLProps>(
	'audit-trusted-html',
	({ expose, first, watch }) => {
		const target = first('[data-target]') as HTMLElement
		expose({ content: '' })
		watch(
			'content',
			dangerouslyBindInnerHTML(target, { sanitize: sanitizeToTrustedHTML }),
		)
	},
)

/* === DOMPurify integration, for real === */
//
// The library's own JSDoc and ADR-0010 name DOMPurify configured with
// `RETURN_TRUSTED_TYPE: true` as the canonical way to produce a TrustedHTML
// for the sanitize hook. audit-dompurify exercises that exact, real
// integration (not a stand-in) under Trusted-Types enforcement, so a future
// DOMPurify release that renames/removes the option, or changes what it
// returns, fails this test instead of silently going stale in the docs.

type DOMPurifyProps = {
	content: string
}

declare global {
	interface HTMLElementTagNameMap {
		'audit-dompurify': HTMLElement & DOMPurifyProps
	}
}

defineComponent<DOMPurifyProps>(
	'audit-dompurify',
	({ expose, first, watch }) => {
		const target = first('[data-target]') as HTMLElement
		expose({ content: '' })
		watch(
			'content',
			dangerouslyBindInnerHTML(target, {
				sanitize: (html: string) =>
					DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true }),
			}),
		)
	},
)
