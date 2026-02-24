/**
 * Security test components for safeSetAttribute behavior verification.
 *
 * These minimal components exist solely to exercise the safeSetAttribute
 * security checks in Playwright tests (form-listbox.spec.ts). They are
 * not example components and are not rendered in the docs.
 *
 * - security-onevil: tries to set `onclick` attribute (blocked: on* name)
 * - security-urlhref: tries to set `href` attribute (blocked if unsafe protocol)
 */

import { asString, defineComponent, setAttribute } from '../..'

type EvilProps = { src: string }
type HrefProps = { href: string }
type LinkUI = { link: HTMLAnchorElement }

// Component that sets an event-handler attribute name (blocked by safeSetAttribute)
defineComponent<EvilProps, LinkUI>(
	'security-onevil',
	{ src: asString() },
	({ first }) => ({ link: first('a', 'Add an anchor element.') }),
	() => ({
		link: setAttribute<EvilProps, HTMLAnchorElement>('onclick', 'src'),
	}),
)

// Component that sets href — safe values pass, unsafe protocol values are blocked
defineComponent<HrefProps, LinkUI>(
	'security-urlhref',
	{ href: asString() },
	({ first }) => ({ link: first('a', 'Add an anchor element.') }),
	() => ({
		link: setAttribute<HrefProps, HTMLAnchorElement>('href', 'href'),
	}),
)
