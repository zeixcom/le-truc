import Markdoc, {
	type Node,
	type RenderableTreeNode,
	Tag,
} from '@markdoc/markdoc'
import markdocConfig from './markdoc.config'

// Common attribute definitions for reuse across schemas
const classAttribute = {
	type: String,
}

const idAttribute = {
	type: String,
}

const styleAttribute = {
	type: String,
}

const titleAttribute = {
	type: String,
}

const requiredTitleAttribute = {
	type: String,
	required: true,
}

// Common children arrays for different content types
const standardChildren = [
	'paragraph',
	'heading',
	'list',
	'blockquote',
	'hr',
	'fence',
	'callout',
	'tag',
	'inline',
]

const richChildren = [
	'paragraph',
	'heading',
	'list',
	'item',
	'blockquote',
	'hr',
	'fence',
	'callout',
	'tag',
	'inline',
	'text',
	'strong',
	'em',
	'code',
	'link',
]

// Common attribute sets
const commonAttributes = {
	class: classAttribute,
	id: idAttribute,
	style: styleAttribute,
}

// Text extraction utility used by multiple schemas
const extractTextFromNode = (node: Node): string => {
	if (node.type === 'text') return node.attributes.content || ''
	if (node.children) return node.children.map(extractTextFromNode).join('')
	return node.attributes?.content || ''
}

// Transform child nodes with markdoc config
const renderChildren = (children: Node[]): RenderableTreeNode[] =>
	children.map((child: Node) => Markdoc.transform(child, markdocConfig))

// Split content by separator nodes (used by carousel, tabgroup, demo)
const splitContentBySeparator = (
	children: Node[],
	separatorType: string = 'hr',
): Node[][] => {
	const sections: Node[][] = []
	let currentSection: Node[] = []

	for (const child of children) {
		if (child.type === separatorType) {
			if (currentSection.length) {
				sections.push(currentSection)
				currentSection = []
			}
		} else {
			currentSection.push(child)
		}
	}

	// Add the last section if it has content
	if (currentSection.length) sections.push(currentSection)
	return sections
}

// HTML escaping utility for template literals when needed
/* const escapeHtml = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;') */

// Helper function to create error callouts using the existing callout schema
const createErrorCallout = (
	title: string,
	message: string,
	content?: string,
): Tag => {
	const children: Tag[] = [new Tag('p', {}, [message])]
	if (content) children.push(new Tag('pre', {}, [content]))
	return new Tag('card-callout', { class: 'danger', title }, children)
}

// Hyperscript-style helper functions for creating Markdoc Tags
// These provide a JSX-like syntax that's more readable than `new Tag(...)`

/**
 * Main hyperscript function - creates a Tag with the given tag name, attributes, and children
 * Usage: h('div', { class: 'container' }, ['Hello world'])
 */
const h = (
	tagName: string,
	attributes?: Record<string, any> | null,
	children?: RenderableTreeNode[] | RenderableTreeNode | string | null,
): Tag => {
	// Normalize children to array
	let childrenArray: RenderableTreeNode[] = []
	if (children !== null && children !== undefined) {
		if (Array.isArray(children)) {
			childrenArray = children
		} else {
			childrenArray = [children]
		}
	}

	return new Tag(tagName, attributes || {}, childrenArray)
}

/**
 * Fragment helper - creates a Tag with no wrapper element (undefined tagName)
 * Usage: fragment(['child1', 'child2'])
 */
const fragment = (
	children: RenderableTreeNode[] | RenderableTreeNode | string,
): Tag => {
	return h(undefined as any, null, children)
}

// HTML template literal parser for Markdoc Tags
// This allows writing HTML-like syntax that gets converted to Markdoc Tag objects
// Usage: html`<div class="container">${content}</div>`
//
// Examples:
//   Single element: html`<p>Hello ${name}</p>`
//   Nested: html`<div><span>Nested ${content}</span></div>`

type ParsedElement = {
	tagName: string | null // null for fragments
	attributes: Record<string, any>
	children: (ParsedElement | string)[]
	isSelfClosing: boolean
}

/**
 * Parse HTML template literal into Markdoc Tags
 */
const html = (
	strings: TemplateStringsArray,
	...values: any[]
): RenderableTreeNode | RenderableTreeNode[] => {
	// Combine template strings with interpolated values
	let htmlString = ''
	for (let i = 0; i < strings.length; i++) {
		htmlString += strings[i]
		if (i < values.length) {
			const value = values[i]
			if (typeof value === 'string') htmlString += value
			else htmlString += `__PLACEHOLDER_${i}__`
		}
	}

	try {
		// Resolve tag name placeholders before parsing
		let resolvedHtml = htmlString.trim()
		for (let i = 0; i < values.length; i++) {
			const placeholder = `__PLACEHOLDER_${i}__`
			const value = values[i]
			// Resolve values that could be tag names or parts of tag names
			if (typeof value === 'string' || typeof value === 'number') {
				const tagValue = String(value)
				// Only process values that could be valid tag name components
				if (/^[a-zA-Z0-9]+$/.test(tagValue)) {
					const escapedPlaceholder = placeholder.replace(
						/[.*+?^${}()|[\]\\]/g,
						'\\$&',
					)

					// Replace placeholders that appear in tag contexts
					// This handles cases like <h__PLACEHOLDER_0__>, <__PLACEHOLDER_0__, </h__PLACEHOLDER_1__>, etc.
					resolvedHtml = resolvedHtml.replace(
						new RegExp(
							`([<>a-zA-Z]*)${escapedPlaceholder}([^a-zA-Z0-9]|$)`,
							'g',
						),
						`$1${tagValue}$2`,
					)
				}
			}
		}

		// Parse the HTML string into elements
		const parsed = parseHTML(resolvedHtml)

		// Convert parsed elements to Markdoc Tags, replacing remaining placeholders with actual values
		const result = convertToTag(parsed, values)

		// If this is a fragment, return the children array directly
		if (Array.isArray(result)) {
			return result
		}

		return result
	} catch (error) {
		// Return a danger callout instead of throwing
		return createErrorCallout(
			'HTML Template Error',
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			htmlString.trim(),
		)
	}
}

/**
 * Simple HTML parser that handles the subset we need
 */
const parseHTML = (html: string): ParsedElement | string => {
	html = html.trim()
	if (!html.startsWith('<')) return html

	// Parse opening tag
	const openTagMatch = html.match(/^<([a-zA-Z0-9-]+)([^>]*)>/)
	if (!openTagMatch) {
		throw new Error(
			`Invalid HTML opening tag: ${html.slice(0, 100)}${html.length > 100 ? '...' : ''}`,
		)
	}

	const tagName = openTagMatch[1]
	const attributesString = openTagMatch[2].trim()

	// Check if it's self-closing
	const isSelfClosing =
		attributesString.endsWith('/')
		|| [
			'img',
			'br',
			'hr',
			'input',
			'meta',
			'link',
			'area',
			'base',
			'col',
			'embed',
			'source',
			'track',
			'wbr',
		].includes(tagName)

	// Parse attributes
	const attributes = parseAttributes(attributesString.replace(/\/$/, ''))

	if (isSelfClosing) {
		return {
			tagName,
			attributes,
			children: [],
			isSelfClosing: true,
		}
	}

	// Find the matching closing tag
	const openTagEnd = openTagMatch[0].length
	const remainingHtml = html.slice(openTagEnd)

	let tagDepth = 1
	let pos = 0

	while (pos < remainingHtml.length && tagDepth > 0) {
		const nextOpenTag = remainingHtml.indexOf(`<${tagName}`, pos)
		const nextCloseTag = remainingHtml.indexOf(`</${tagName}>`, pos)

		if (nextCloseTag === -1) {
			throw new Error(
				`No closing tag found for <${tagName}>. Content: ${remainingHtml.slice(0, 100)}${remainingHtml.length > 100 ? '...' : ''}`,
			)
		}

		if (nextOpenTag !== -1 && nextOpenTag < nextCloseTag) {
			tagDepth++
			pos = nextOpenTag + tagName.length + 1
		} else {
			tagDepth--
			if (tagDepth === 0) {
				const innerContent = remainingHtml.slice(0, nextCloseTag).trim()
				const children = parseChildren(innerContent)

				return {
					tagName,
					attributes,
					children,
					isSelfClosing: false,
				}
			}
			pos = nextCloseTag + tagName.length + 3
		}
	}

	throw new Error(
		`Malformed HTML - unmatched tags for <${tagName}>. Content: ${html.slice(0, 200)}${html.length > 200 ? '...' : ''}`,
	)
}

/**
 * Parse children content (which may contain multiple elements and text)
 */
const parseChildren = (content: string): (ParsedElement | string)[] => {
	if (!content) return []

	const children: (ParsedElement | string)[] = []
	let pos = 0

	while (pos < content.length) {
		while (pos < content.length && /\s/.test(content[pos])) pos++
		if (pos >= content.length) break

		if (content[pos] === '<') {
			// Find the end of this element by finding the matching closing tag
			let elementEnd = pos + 1

			// Extract tag name from opening tag
			const tagMatch = content.slice(pos).match(/^<([a-zA-Z0-9-]+)/)
			if (!tagMatch) {
				// Skip invalid tags
				pos++
				continue
			}

			const tagName = tagMatch[1]

			// Check if it's self-closing
			const selfClosingMatch = content.slice(pos).match(/^<[^>]*\/>/)
			if (selfClosingMatch) {
				elementEnd = pos + selfClosingMatch[0].length
			} else {
				// Find matching closing tag
				const openTag = `<${tagName}`
				const closeTag = `</${tagName}>`
				let depth = 1
				let searchPos = pos + tagMatch[0].length

				while (searchPos < content.length && depth > 0) {
					const nextOpen = content.indexOf(openTag, searchPos)
					const nextClose = content.indexOf(closeTag, searchPos)

					if (nextClose === -1) {
						throw new Error(`No closing tag found for <${tagName}>`)
					}

					if (nextOpen !== -1 && nextOpen < nextClose) {
						// Another opening tag of same name found
						depth++
						searchPos = nextOpen + openTag.length
					} else {
						// Closing tag found
						depth--
						if (depth === 0) {
							elementEnd = nextClose + closeTag.length
							break
						}
						searchPos = nextClose + closeTag.length
					}
				}

				if (depth > 0) {
					throw new Error(`Unmatched opening tag for <${tagName}>`)
				}
			}

			const elementHtml = content.slice(pos, elementEnd)
			try {
				children.push(parseHTML(elementHtml))
			} catch (error) {
				// If parsing fails for a child element, add error info to the message
				throw new Error(
					`Error parsing child element: ${error instanceof Error ? error.message : String(error)}. Element: ${elementHtml.slice(0, 100)}${elementHtml.length > 100 ? '...' : ''}`,
				)
			}
			pos = elementEnd
		} else {
			// Text content
			let textEnd = pos
			while (textEnd < content.length && content[textEnd] !== '<') textEnd++

			const textContent = content.slice(pos, textEnd).trim()
			if (textContent) children.push(textContent)
			pos = textEnd
		}
	}

	return children
}

/**
 * Parse HTML attributes string into object
 */
const parseAttributes = (attributesString: string): Record<string, any> => {
	const attributes: Record<string, any> = {}

	if (!attributesString.trim()) return attributes

	// Simple attribute parsing - handles: attr="value", attr='value', attr=value, attr
	const attrRegex = /([a-zA-Z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g
	let match: RegExpExecArray | null | undefined
	while ((match = attrRegex.exec(attributesString)) !== null) {
		const [, name, doubleQuoted, singleQuoted, unquoted] = match
		const value = doubleQuoted ?? singleQuoted ?? unquoted ?? true

		// Convert some common attribute names
		const attrName = name === 'class' ? 'class' : name
		attributes[attrName] = value
	}

	return attributes
}

/**
 * Convert parsed elements to Markdoc Tags, replacing placeholders with interpolated values
 */
const convertToTag = (
	parsed: ParsedElement | string,
	values: any[],
): RenderableTreeNode | RenderableTreeNode[] => {
	if (typeof parsed === 'string') {
		// Check for placeholders and replace them
		let result: RenderableTreeNode | string = parsed
		for (let index = 0; index < values.length; index++) {
			const placeholder = `__PLACEHOLDER_${index}__`
			if (typeof result === 'string' && result.includes(placeholder)) {
				const value = values[index]
				// If the entire string is just a placeholder, return the value directly
				if (result === placeholder) return value
				// Otherwise, replace placeholder with string representation
				result = result.replace(placeholder, String(value))
			}
		}
		return result
	}

	// Convert children, flattening arrays from nested fragments
	const children: RenderableTreeNode[] = []
	for (const child of parsed.children) {
		const converted = convertToTag(child, values)
		if (Array.isArray(converted)) children.push(...converted)
		else children.push(converted)
	}

	// Handle fragments (tagName is null) - return children array directly
	if (parsed.tagName === null) {
		return children
	}

	// Replace placeholders in attributes
	const attributes: Record<string, any> = {}
	for (const [key, value] of Object.entries(parsed.attributes)) {
		if (typeof value === 'string') {
			let attrValue: any = value
			for (let index = 0; index < values.length; index++) {
				const placeholder = `__PLACEHOLDER_${index}__`
				if (attrValue.includes(placeholder)) {
					const val = values[index]
					// If the entire attribute is just a placeholder, use the value directly
					if (attrValue === placeholder) {
						attrValue = val
						break
					}
					// Otherwise, replace placeholder with string representation
					attrValue = attrValue.replace(placeholder, String(val))
				}
			}
			attributes[key] = attrValue
		} else {
			attributes[key] = value
		}
	}

	return new Tag(parsed.tagName, attributes, children)
}

export {
	commonAttributes,
	extractTextFromNode,
	fragment,
	h,
	html,
	splitContentBySeparator,
	standardChildren,
	styleAttribute,
	renderChildren,
	requiredTitleAttribute,
	richChildren,
	titleAttribute,
}
