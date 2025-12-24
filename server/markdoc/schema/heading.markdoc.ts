import Markdoc, {
	type Config,
	type Node,
	type Schema,
	type Tag,
} from '@markdoc/markdoc'
import { generateId, html } from '../utils'

const heading: Schema = {
	...Markdoc.nodes.heading,
	transform(node: Node, config: Config) {
		if (!Markdoc.nodes.heading.transform) {
			// Fallback to basic heading rendering if built-in transform is missing
			const level = node.attributes.level ?? 1
			const text =
				node.children
					?.map(child =>
						typeof child === 'string' ? child : child.children?.join(' ') || '',
					)
					.join(' ') || ''
			const slug = generateId(text)

			return html`<h${level} id="${slug}">
				<a name="${slug}" class="anchor" href="#${slug}">
					<span class="permalink">🔗</span>
					<span class="title">${text}</span>
				</a>
			</h${level}>`
		}

		const base = Markdoc.nodes.heading.transform(node, config) as Tag
		const level = node.attributes.level ?? base.attributes?.level ?? 1

		const text =
			base.children?.filter(child => typeof child === 'string').join(' ') || ''
		const slug = generateId(text)

		return html`<h${level} id="${slug}">
			<a name="${slug}" class="anchor" href="#${slug}">
				<span class="title">${text}</span>
				<span class="permalink">#</span>
			</a>
		</h${level}>`
	},
}

export default heading
