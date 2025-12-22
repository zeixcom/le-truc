import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
} from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import { html, STANDARD_CHILDREN } from '../utils'

const hero: Schema = {
	render: 'section-hero',
	children: STANDARD_CHILDREN,
	attributes: COMMON_ATTRIBUTES,
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
