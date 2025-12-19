import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
} from '@markdoc/markdoc'
import { commonAttributes, html, standardChildren } from '../markdoc-helpers'

const hero: Schema = {
	render: 'section-hero',
	children: standardChildren,
	attributes: commonAttributes,
	transform(node: Node, config: Config) {
		// Separate title from other content
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

		// Create two-column layout with lead content and TOC placeholder
		return html`<section-hero>
			${title}
			<div class="hero-layout">
				<div class="lead">${leadContent}</div>
				<div class="toc-placeholder" data-toc="true"></div>
			</div>
		</section-hero>`
	},
}

export default hero
