import Markdoc, {
	type Config,
	type Node,
	type Schema,
	Tag,
} from '@markdoc/markdoc'
import { html } from '../markdoc-helpers'

function generateSlug(text: string): string {
	// Decode HTML entities first
	const decoded = text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')

	// Generate URL-friendly slug from text
	return decoded
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '')
		.trim()
}

const heading: Schema = {
	...Markdoc.nodes.heading,
	transform(node: Node, config: Config) {
		if (!Markdoc.nodes.heading.transform) {
			throw new Error('Markdoc.nodes.heading.transform is not defined')
		}
		const base = Markdoc.nodes.heading.transform(node, config) as Tag
		const level = node.attributes.level ?? base.attributes?.level ?? 1

		const text =
			base.children?.filter(child => typeof child === 'string').join(' ') || ''
		const slug = generateSlug(text)

		return html`<h${level} id="${slug}">
			<a name="${slug}" class="anchor" href="#${slug}">
				<span class="permalink">🔗</span>
				<span class="title">${text}</span>
			</a>
		</h${level}>`
	},
}

export default heading
