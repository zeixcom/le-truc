/* === Internal Functions === */

const isSafeURL = (value: string): boolean => {
	if (/^(mailto|tel):/i.test(value)) return true
	if (value.includes('://')) {
		try {
			const url = new URL(value, window.location.origin)
			return ['http:', 'https:', 'ftp:'].includes(url.protocol)
		} catch {
			return false
		}
	}
	return true
}

/* === Exported Functions === */

/**
 * Set an attribute on an element with security validation.
 *
 * Blocks `on*` event handler attributes and validates URL-like values against
 * a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).
 * Violations throw a descriptive error — they are never silent.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} attr - Attribute name to set
 * @param {string} value - Attribute value to set
 */
const safeSetAttribute = (
	element: Element,
	attr: string,
	value: string,
): void => {
	if (/^on/i.test(attr))
		throw new Error(
			`setAttribute: blocked unsafe attribute name '${attr}' on ${element.localName} — event handler attributes are not allowed`,
		)
	value = String(value).trim()
	if (!isSafeURL(value))
		throw new Error(
			`setAttribute: blocked unsafe value for '${attr}' on <${element.localName}>: '${value}'`,
		)
	element.setAttribute(attr, value)
}

/**
 * Escape HTML entities to prevent XSS when inserting user-supplied text as HTML.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 1.1
 * @param {string} text - Plain text to escape
 * @returns {string} HTML-safe string
 */
const escapeHTML = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

/**
 * Set the text content of an element while preserving comment nodes.
 *
 * Removes all child nodes except comments, then appends a new text node.
 * Useful when HTML comments are used as markers or server-rendered annotations.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} text - Text content to set
 */
const setTextPreservingComments = (element: Element, text: string): void => {
	Array.from(element.childNodes)
		.filter(node => node.nodeType !== Node.COMMENT_NODE)
		.forEach(node => node.remove())
	element.append(document.createTextNode(text))
}

export { escapeHTML, safeSetAttribute, setTextPreservingComments }
