import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
} from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-constants'

const hero: Schema = {
	render: 'section-hero',
	children: standardChildren,
	attributes: commonAttributes,
	transform(node: Node, config: Config) {
		// Create a placeholder that will be replaced during page generation
		const tocPlaceholder = new Markdoc.Tag('div', {
			class: 'toc-placeholder',
			'data-toc': 'true',
		})

		// Separate title from other content
		let title: RenderableTreeNode | null = null
		const leadContent: RenderableTreeNode[] = []

		for (const child of node.children) {
			if (child.type === 'heading' && child.attributes.level === 1) {
				title = Markdoc.transform(child, config)
			} else if (child.type === 'paragraph') {
				const transformed = Markdoc.transform(child, config)
				if (transformed) {
					leadContent.push(transformed)
				}
			}
		}

		// Create the structured layout
		const children: RenderableTreeNode[] = []

		// Add title (full width)
		if (title) {
			children.push(title)
		}

		// Create two-column layout with lead content and TOC placeholder
		if (leadContent.length > 0) {
			const layoutDiv = new Markdoc.Tag('div', { class: 'hero-layout' }, [
				new Markdoc.Tag('div', { class: 'lead' }, leadContent),
				tocPlaceholder,
			])
			children.push(layoutDiv)
		} else if (tocPlaceholder) {
			// Just TOC placeholder if no lead content
			children.push(tocPlaceholder)
		}

		return new Markdoc.Tag('section-hero', node.attributes, children)
	},
}

export default hero
