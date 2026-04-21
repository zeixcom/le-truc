import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
	Tag,
} from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-constants'

const hero: Schema = {
	render: 'section-hero',
	children: standardChildren,
	attributes: commonAttributes,
	transform(node: Node, config: Config) {
		const tocPlaceholder = new Tag(
			'div',
			{ class: 'toc-placeholder', 'data-toc': 'true' },
			[],
		)

		// Separate title from lead paragraphs
		let title: RenderableTreeNode | null = null
		const leadContent: RenderableTreeNode[] = []

		for (const child of node.children) {
			if (child.type === 'heading' && child.attributes.level === 1) {
				title = Markdoc.transform(child, config)
			} else if (child.type === 'paragraph') {
				const transformed = Markdoc.transform(child, config)
				if (transformed) leadContent.push(transformed)
			}
		}

		// Create the structured layout
		const children: RenderableTreeNode[] = []

		// Title spans full width
		if (title) children.push(title)

		if (leadContent.length > 0) {
			// Two-column layout: lead text + toc placeholder
			children.push(
				new Tag('div', { class: 'hero-layout' }, [
					new Tag('div', { class: 'lead' }, leadContent),
					tocPlaceholder,
				]),
			)
		} else {
			// No lead content: toc placeholder sits directly under the hero
			children.push(tocPlaceholder)
		}

		return new Tag('section-hero', node.attributes, children)
	},
}

export default hero
