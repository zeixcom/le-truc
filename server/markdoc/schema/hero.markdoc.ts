import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
} from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import { collectedHeadings, html, STANDARD_CHILDREN } from '../utils'

/* === Internal Functions === */

/**
 * Generate TOC HTML from collected headings
 */
const generateTocFromCollected = (
	levels: number[] = [2],
	title: string = 'On This Page',
	minCount: number = 3,
) => {
	const filteredHeadings = collectedHeadings.filter(heading =>
		levels.includes(heading.level),
	)

	if (filteredHeadings.length < minCount) {
		return ''
	}

	const tocItems = filteredHeadings
		.map(
			({ id, title: headingTitle }) =>
				`<li>
					<a href="#${id}">${headingTitle}</a>
				</li>`,
		)
		.join('')

	return html`<module-toc>
		<nav>
			<h2>${title}</h2>
			<ol>
				${tocItems}
			</ol>
		</nav>
	</module-toc>`
}

/* === Exported Schema === */

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

		// Generate TOC from collected headings (only if 3+ H2 headings)
		const tocHtml = generateTocFromCollected([2], 'On This Page', 3)

		// Create two-column layout with lead content and conditional TOC
		return html`<section-hero>
			${title}
			<div class="hero-layout">
				<div class="lead">${leadContent}</div>
				${tocHtml}
			</div>
		</section-hero>`
	},
}

export default hero
