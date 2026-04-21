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

import { asString, defineComponent, safeSetAttribute } from '../../..'

type EvilProps = { src: string }
type HrefProps = { href: string }

// Component that sets an event-handler attribute name (blocked by safeSetAttribute)
defineComponent<EvilProps>(
	'security-onevil',
	({ expose, first, host, watch }) => {
		const link = first('a', 'Add an anchor element.') as HTMLAnchorElement
		expose({ src: asString() })
		return [
			watch('src', value => {
				try {
					safeSetAttribute(link, 'onclick', value)
				} catch (error) {
					console.error(
						`Failed to set attribute 'onclick' on <${link.localName}> in ${host.localName}`,
						error,
					)
				}
			}),
		]
	},
)

// Component that sets href — safe values pass, unsafe protocol values are blocked
defineComponent<HrefProps>(
	'security-urlhref',
	({ expose, first, host, watch }) => {
		const link = first('a', 'Add an anchor element.') as HTMLAnchorElement
		expose({ href: asString() })
		return [
			watch('href', value => {
				try {
					safeSetAttribute(link, 'href', value)
				} catch (error) {
					console.error(
						`Failed to set attribute 'href' on <${link.localName}> in ${host.localName}`,
						error,
					)
				}
			}),
		]
	},
)
