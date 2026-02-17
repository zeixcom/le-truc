import Markdoc, {
	type Node,
	type RenderableTreeNode,
	Tag,
	type ValidationError,
} from '@markdoc/markdoc'
import markdocConfig from './markdoc.config'
import { generateSlug as templateSlug } from './templates/utils'

/* === Types === */

type ParsedElement = {
	tagName: string
	attributes: Record<string, any>
	children: (ParsedElement | string)[]
	isSelfClosing: boolean
}

type RawTextMarker = {
	__rawText: true
	content: string
}

/* === Attribute Classes === */

/**
 * Custom attribute type for class that handles both string and shorthand syntax
 * Converts shorthand object like { "class1": true, "class2": true } to "class1 class2"
 */
export class ClassAttribute {
	validate(value: any): ValidationError[] {
		if (typeof value === 'string') return []
		if (typeof value === 'object' && value !== null) return []
		return [
			{
				id: 'invalid-class-type',
				level: 'error' as const,
				message: 'Class must be a string or shorthand object',
			},
		]
	}

	transform(value: any): string {
		if (typeof value === 'string') return value
		if (typeof value === 'object' && value !== null) {
			return Object.keys(value)
				.filter(key => value[key])
				.join(' ')
		}
		return ''
	}
}

/**
 * Custom attribute type for id that ensures it's always a string
 */
export class IdAttribute {
	validate(value: any): ValidationError[] {
		if (typeof value === 'string') return []
		return [
			{
				id: 'invalid-id-type',
				level: 'error' as const,
				message: 'ID must be a string',
			},
		]
	}

	transform(value: any): string {
		return String(value)
	}
}

/**
 * Custom attribute type for callout class that validates against allowed values
 */
export class CalloutClassAttribute {
	private allowedValues = ['info', 'tip', 'danger', 'note', 'caution']

	validate(value: any): ValidationError[] {
		const stringValue = this.transform(value)
		if (!this.allowedValues.includes(stringValue)) {
			return [
				{
					id: 'attribute-value-invalid',
					level: 'error' as const,
					message: `Attribute 'class' must match one of ${JSON.stringify(this.allowedValues)}. Got '${stringValue}' instead.`,
				},
			]
		}
		return []
	}

	transform(value: any): string {
		if (typeof value === 'string') return value
		if (typeof value === 'object' && value !== null) {
			const classes = Object.keys(value).filter(key => value[key])
			const firstValidClass = classes.find(cls =>
				this.allowedValues.includes(cls),
			)
			return firstValidClass || classes[0] || 'info'
		}
		return 'info'
	}
}

/* === Attribute Definitions === */

export const classAttribute = {
	type: ClassAttribute,
}

export const idAttribute = {
	type: IdAttribute,
}

export const styleAttribute = {
	type: String,
}

export const titleAttribute = {
	type: String,
}

export const requiredTitleAttribute = {
	type: String,
	required: true,
}

// Common attribute sets
export const commonAttributes = {
	class: classAttribute,
	id: idAttribute,
}

export const styledAttributes = {
	...commonAttributes,
	style: styleAttribute,
}

/* === Constants === */

export const standardChildren = [
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

export const richChildren = [
	...standardChildren,
	'item',
	'text',
	'strong',
	'em',
	'code',
	'link',
]

/* === Node Utilities === */

// When skipLists is true, skips text content from nested list nodes
export function extractTextFromNode(
	node: Node,
	skipLists: boolean = false,
): string {
	if (node.type === 'text') return node.attributes.content || ''
	if (skipLists && node.type === 'list') return ''
	if (node.children)
		return node.children
			.map(child => extractTextFromNode(child, skipLists))
			.join('')
	return node.attributes?.content || ''
}

export function transformChildrenWithConfig(
	children: Node[],
): RenderableTreeNode[] {
	return children.map((child: Node) => Markdoc.transform(child, markdocConfig))
}

export function splitContentBySeparator(
	children: Node[],
	separatorType: string = 'hr',
): Node[][] {
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

	if (currentSection.length) sections.push(currentSection)
	return sections
}

/* === ID / Slug Generation === */

export function generateId(text: string = ''): string {
	if (!text) return Math.random().toString(36).substring(2, 9)

	const decoded = text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')

	return decoded
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
		.trim()
}

export function generateSlug(text: string): string {
	const decoded = text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')

	return templateSlug(decoded)
}

/* === Navigation Helpers === */

const findLinkNode = (node: Node): Node | null => {
	if (node.type === 'link') return node
	if (node.children) {
		for (const child of node.children) {
			const found = findLinkNode(child)
			if (found) return found
		}
	}
	return null
}

export function extractNavigationItem(
	item: Node,
): { label: string; src: string } | null {
	const linkNode = findLinkNode(item)
	if (!linkNode) return null

	const label = extractTextFromNode(item)
	const src = linkNode.attributes?.href || ''

	return { label, src }
}

/* === Tag Helpers === */

export function createNavigationButton(
	type: 'prev' | 'next',
	label?: string,
): Tag {
	const defaultLabels = { prev: '❮', next: '❯' }
	const ariaLabels = { prev: 'Previous', next: 'Next' }

	return new Tag(
		'button',
		{
			type: 'button',
			class: type,
			'aria-label': ariaLabels[type],
		},
		[label || defaultLabels[type]],
	)
}

export function createTabButton(options: {
	id: string
	label: string
	controls: string
	selected?: boolean
	index?: number
}): Tag {
	const { id, label, controls, selected = false, index = 0 } = options

	return new Tag(
		'button',
		{
			role: 'tab',
			id,
			'aria-controls': controls,
			'aria-label': label,
			'aria-selected': String(selected),
			'data-index': String(index),
			tabindex: selected ? '0' : '-1',
		},
		['●'],
	)
}

export function createAccessibleHeading(
	level: number,
	text: string,
	attributes: Record<string, any> = {},
): Tag {
	const slug = generateSlug(text)

	return new Tag(`h${level}`, { id: slug, ...attributes }, [
		new Tag('a', { name: slug, class: 'anchor', href: `#${slug}` }, [
			new Tag('span', { class: 'permalink' }, ['🔗']),
			new Tag('span', { class: 'title' }, [text]),
		]),
	])
}

export function createVisuallyHiddenHeading(text: string): Tag {
	return new Tag('h2', { class: 'visually-hidden' }, [text])
}

/* === Error / Validation Helpers === */

const createErrorCallout = (
	title: string,
	message: string,
	content?: string,
): Tag => {
	const children: Tag[] = [new Tag('p', {}, [message])]
	if (content) children.push(new Tag('pre', {}, [content]))
	return new Tag('card-callout', { class: 'danger', title }, children)
}

export function renderValidationErrors(
	errors: ValidationError[],
	title: string = 'Validation Errors',
): RenderableTreeNode {
	const errorMessages = errors.map(
		error => html`<p><strong>${error.id}:</strong> ${error.message}</p>`,
	)

	return html`<card-callout class="danger" title="${title}">
		${errorMessages}
	</card-callout>` as RenderableTreeNode
}

/* === HTML Post-Processing === */

export function postProcessHtml(htmlStr: string, section?: string): string {
	htmlStr = htmlStr.replace(
		/href="([^"]*\.md)"/g,
		(_, href) => `href="${href.replace(/\.md$/, '.html')}"`,
	)

	if (section === 'api') {
		htmlStr = `<section class="api-content">\n${htmlStr}\n</section>`
	}

	return htmlStr
}

/* === HTML Template Literal === */

const isRawTextMarker = (value: any): value is RawTextMarker =>
	value && typeof value === 'object' && value.__rawText === true

export const rawText = (content: string): RawTextMarker => ({
	__rawText: true,
	content,
})

/**
 * HTML template literal parser for Markdoc Tags.
 * Allows writing HTML-like syntax that gets converted to Markdoc Tag objects.
 *
 * Usage: html\`<div class="container">\${content}</div>\`
 */
export const html = (
	strings: TemplateStringsArray,
	...values: any[]
): RenderableTreeNode | RenderableTreeNode[] => {
	let htmlString = ''
	for (let i = 0; i < strings.length; i++) {
		htmlString += strings[i]
		if (i < values.length) {
			const value = values[i]
			if (typeof value === 'string') htmlString += value
			else if (isRawTextMarker(value)) htmlString += `__RAWTEXT_${i}__`
			else htmlString += `__PLACEHOLDER_${i}__`
		}
	}

	try {
		let resolvedHtml = htmlString.trim()
		for (let i = 0; i < values.length; i++) {
			const placeholder = `__PLACEHOLDER_${i}__`
			const value = values[i]
			if (typeof value === 'string' || typeof value === 'number') {
				const tagValue = String(value)
				if (/^[a-zA-Z0-9]+$/.test(tagValue)) {
					const escapedPlaceholder = placeholder.replace(
						/[.*+?^${}()|[\]\\]/g,
						'\\$&',
					)
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

		const parsed = parseHTML(resolvedHtml)
		const result = convertToTag(parsed, values)

		if (Array.isArray(result)) return result
		return result
	} catch (error) {
		return createErrorCallout(
			'HTML Template Error',
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			htmlString.trim(),
		)
	}
}

/* === HTML Parser (internal) === */

const parseHTML = (html: string): ParsedElement | string => {
	html = html.trim()
	if (!html.startsWith('<')) return html

	const openTagMatch = html.match(/^<([a-zA-Z0-9-]+)([^>]*)>/)
	if (!openTagMatch) {
		throw new Error(
			`Invalid HTML opening tag: ${html.slice(0, 100)}${html.length > 100 ? '...' : ''}`,
		)
	}

	const tagName = openTagMatch[1]
	const attributesString = openTagMatch[2].trim()

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

	const attributes = parseAttributes(attributesString.replace(/\/$/, ''))

	if (isSelfClosing) {
		return { tagName, attributes, children: [], isSelfClosing: true }
	}

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
				return { tagName, attributes, children, isSelfClosing: false }
			}
			pos = nextCloseTag + tagName.length + 3
		}
	}

	throw new Error(
		`Malformed HTML - unmatched tags for <${tagName}>. Content: ${html.slice(0, 200)}${html.length > 200 ? '...' : ''}`,
	)
}

const parseChildren = (content: string): (ParsedElement | string)[] => {
	if (!content) return []

	const children: (ParsedElement | string)[] = []
	let pos = 0

	while (pos < content.length) {
		while (pos < content.length && /\s/.test(content[pos])) pos++
		if (pos >= content.length) break

		if (content[pos] === '<') {
			const tagMatch = content.slice(pos).match(/^<([a-zA-Z0-9-]+)/)
			if (!tagMatch) {
				pos++
				continue
			}

			const tagName = tagMatch[1]
			let elementEnd = pos + 1

			const selfClosingMatch = content.slice(pos).match(/^<[^>]*\/>/)
			if (selfClosingMatch) {
				elementEnd = pos + selfClosingMatch[0].length
			} else {
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
						depth++
						searchPos = nextOpen + openTag.length
					} else {
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
				throw new Error(
					`Error parsing child element: ${error instanceof Error ? error.message : String(error)}. Element: ${elementHtml.slice(0, 100)}${elementHtml.length > 100 ? '...' : ''}`,
				)
			}
			pos = elementEnd
		} else {
			let textEnd = pos
			while (textEnd < content.length && content[textEnd] !== '<') textEnd++

			const textContent = content.slice(pos, textEnd).trim()
			if (textContent) children.push(textContent)
			pos = textEnd
		}
	}

	return children
}

const parseAttributes = (attributesString: string): Record<string, any> => {
	const attributes: Record<string, any> = {}
	if (!attributesString.trim()) return attributes

	const attrRegex = /([a-zA-Z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g
	let match: RegExpExecArray | null | undefined
	while ((match = attrRegex.exec(attributesString)) !== null) {
		const [, name, doubleQuoted, singleQuoted, unquoted] = match
		attributes[name] = doubleQuoted ?? singleQuoted ?? unquoted ?? true
	}

	return attributes
}

const convertToTag = (
	parsed: ParsedElement | string,
	values: any[],
): RenderableTreeNode | RenderableTreeNode[] => {
	if (typeof parsed === 'string') {
		let result: RenderableTreeNode | string = parsed
		for (let index = 0; index < values.length; index++) {
			const placeholder = `__PLACEHOLDER_${index}__`
			const rawTextPlaceholder = `__RAWTEXT_${index}__`

			if (typeof result === 'string' && result.includes(placeholder)) {
				const value = values[index]
				if (result === placeholder) return value
				result = result.replace(placeholder, String(value))
			}

			if (typeof result === 'string' && result.includes(rawTextPlaceholder)) {
				const value = values[index]
				const textContent = isRawTextMarker(value)
					? value.content
					: String(value)
				if (result === rawTextPlaceholder) {
					result = textContent
					break
				}
				result = result.replace(rawTextPlaceholder, textContent)
			}
		}
		return result
	}

	const children: RenderableTreeNode[] = []
	for (const child of parsed.children) {
		const converted = convertToTag(child, values)
		if (Array.isArray(converted)) children.push(...converted)
		else children.push(converted)
	}

	if (parsed.tagName === null) return children

	const attributes: Record<string, any> = {}
	for (const [key, value] of Object.entries(parsed.attributes)) {
		if (typeof value === 'string') {
			let attrValue: any = value
			for (let index = 0; index < values.length; index++) {
				const placeholder = `__PLACEHOLDER_${index}__`
				const rawTextPlaceholder = `__RAWTEXT_${index}__`

				if (attrValue.includes(placeholder)) {
					const val = values[index]
					if (attrValue === placeholder) {
						attrValue = val
						break
					}
					attrValue = attrValue.replace(placeholder, String(val))
				}

				if (attrValue.includes(rawTextPlaceholder)) {
					const val = values[index]
					const textContent = isRawTextMarker(val) ? val.content : String(val)
					if (attrValue === rawTextPlaceholder) {
						attrValue = textContent
						break
					}
					attrValue = attrValue.replace(rawTextPlaceholder, textContent)
				}
			}
			attributes[key] = attrValue
		} else {
			attributes[key] = value
		}
	}

	return new Tag(parsed.tagName, attributes, children)
}
