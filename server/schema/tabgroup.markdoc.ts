import { type Node, type Schema, Tag } from '@markdoc/markdoc'
import {
	commonAttributes,
	extractTextFromNode,
	fragment,
	html,
	splitContentBySeparator,
	standardChildren,
	renderChildren,
} from '../markdoc-helpers'

const tabgroup: Schema = {
	render: 'module-tabgroup',
	children: standardChildren,
	attributes: commonAttributes,
	transform(node: Node) {
		// Process child nodes to find HR separators and collect sections
		const sections = splitContentBySeparator(node.children || [])

		if (sections.length < 2) {
			throw new Error(
				'Tabgroup must contain at least 2 sections separated by horizontal rules (---)',
			)
		}

		const tabs: { label: string; content: Tag; id: string }[] = []

		for (let index = 0; index < sections.length; index++) {
			const section = sections[index]
			if (section.length === 0) continue

			// First node should be a heading
			const firstNode = section[0]

			if (firstNode.type !== 'heading' || firstNode.attributes.level !== 4) {
				throw new Error(
					'Each tabgroup section must start with a level 4 heading (#### Label)',
				)
			}

			const label = firstNode.children?.map(extractTextFromNode).join('').trim()

			if (!label) {
				throw new Error('Tab heading cannot be empty')
			}

			// Transform the remaining content (everything except the heading)
			const contentNodes = section.slice(1)

			// Generate unique ID based on label
			const id = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')

			tabs.push({
				label,
				content: fragment(renderChildren(contentNodes)),
				id,
			})
		}

		return html`<module-tabgroup>
			<div role="tablist">
				${tabs.map((tab, index) => {
					const isSelected = index === 0
					return html`<button
						role="tab"
						id="trigger_${tab.id}"
						aria-controls="panel_${tab.id}"
						aria-selected="${String(isSelected)}"
						tabindex="${isSelected ? '0' : '-1'}"
					>
						${tab.label}
					</button>`
				})}
			</div>
			${tabs.map(
				(tab, index) =>
					html`<div
						role="tabpanel"
						id="panel_${tab.id}"
						aria-labelledby="trigger_${tab.id}"
						${index === 0 ? '' : 'hidden'}
					>
						${tab.content}
					</div>`,
			)}
		</module-tabgroup>`
	},
}

export default tabgroup
