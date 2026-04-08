import Markdoc, {
	type Config,
	type Node,
	type RenderableTreeNode,
	type Schema,
	Tag,
} from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-constants'
import { type TocItem } from '../markdoc-helpers'

const MIN_TOC_HEADINGS = 3

const hero: Schema = {
	render: 'section-hero',
	children: standardChildren,
	attributes: commonAttributes,
	transform(node: Node, config: Config) {
		// Build TOC nav from H2 headings passed as variable (requires ≥ MIN_TOC_HEADINGS)
		const tocItems = (config.variables?.toc ?? []) as TocItem[]
		const tocNav =
			tocItems.length >= MIN_TOC_HEADINGS
				? new Tag('module-toc', {}, [
						new Tag('nav', {}, [
							new Tag('h2', {}, ['In This Page']),
							new Tag(
								'ol',
								{},
								tocItems.map(
									({ id, text }) =>
										new Tag('li', {}, [
											new Tag('a', { href: `#${id}` }, [text]),
										]),
								),
							),
						]),
					])
				: null

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

		// Create the structured layout
		const children: RenderableTreeNode[] = []

		// Add title (full width)
		if (title) children.push(title)

		// Create two-column layout with lead content and TOC nav
		if (leadContent.length > 0 || tocNav) {
			const layoutChildren: RenderableTreeNode[] = []
			if (leadContent.length > 0)
				layoutChildren.push(new Tag('div', { class: 'lead' }, leadContent))
			if (tocNav) layoutChildren.push(tocNav)
			children.push(new Tag('div', { class: 'hero-layout' }, layoutChildren))
		}

		return new Tag('section-hero', node.attributes, children)
	},
}

export default hero
