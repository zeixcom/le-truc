import Markdoc, {
	type Node,
	type RenderableTreeNode,
	Tag,
} from '@markdoc/markdoc'
import markdocConfig from './markdoc.config'
import { generateSlug as templateSlug } from './templates/utils'

// Common attribute definitions for reuse across schemas
export const classAttribute = {
	type: String,
}

export const idAttribute = {
	type: String,
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

// Common children arrays for different content types
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
export const commonAttributes = {
	class: classAttribute,
	id: idAttribute,
}

export const styledAttributes = {
	...commonAttributes,
	style: styleAttribute,
}

// Text extraction utility used by multiple schemas
export function extractTextFromNode(node: Node): string {
	if (node.type === 'text') {
		return node.attributes.content || ''
	}
	if (node.children) {
		return node.children.map(extractTextFromNode).join('')
	}
	return ''
}

// Transform child nodes with markdoc config
export function transformChildrenWithConfig(
	children: Node[],
): RenderableTreeNode[] {
	return children.map((child: Node) => Markdoc.transform(child, markdocConfig))
}

// Split content by separator nodes (used by carousel, tabgroup, demo)
export function splitContentBySeparator(
	children: Node[],
	separatorType: string = 'hr',
): Node[][] {
	const sections: Node[][] = []
	let currentSection: Node[] = []

	for (const child of children) {
		if (child.type === separatorType) {
			if (currentSection.length > 0) {
				sections.push(currentSection)
				currentSection = []
			}
		} else {
			currentSection.push(child)
		}
	}

	// Add the last section if it has content
	if (currentSection.length > 0) {
		sections.push(currentSection)
	}

	return sections
}

// Generate unique ID from text
export function generateUniqueId(text: string, prefix?: string): string {
	const baseId = text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')

	return prefix ? `${prefix}_${baseId}` : baseId
}

// Create navigation button
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

// Create tab button for navigation
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

// Create accessible heading with anchor
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

// Create visually hidden heading for accessibility
export function createVisuallyHiddenHeading(text: string): Tag {
	return new Tag('h2', { class: 'visually-hidden' }, [text])
}

export function postProcessHtml(html: string, section?: string): string {
	// Fix internal links (.md -> .html)
	html = html.replace(
		/href="([^"]*\.md)"/g,
		(_, href) => `href="${href.replace(/\.md$/, '.html')}"`,
	)

	// Wrap API pages
	if (section === 'api') {
		html = `<section class="api-content">\n${html}\n</section>`
	}

	return html
}

export function generateSlug(text: string): string {
	// Decode HTML entities first
	const decoded = text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')

	// Use the existing slug generator
	return templateSlug(decoded)
}
