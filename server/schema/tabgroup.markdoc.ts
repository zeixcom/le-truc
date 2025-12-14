import { type Node, type Schema, Tag } from '@markdoc/markdoc'
import {
	commonAttributes,
	extractTextFromNode,
	splitContentBySeparator,
	standardChildren,
	transformChildrenWithConfig,
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
			const transformedContent = transformChildrenWithConfig(contentNodes)

			// Generate unique ID based on label
			const baseId = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
			const id = `panel_${baseId}`

			tabs.push({
				label,
				content: new Tag(undefined, {}, transformedContent),
				id,
			})
		}

		// Generate the HTML structure using Tags
		const tablistButtons = tabs.map((tab, index) => {
			const isSelected = index === 0
			const triggerId = tab.id.replace('panel_', 'trigger_')
			return new Tag(
				'button',
				{
					role: 'tab',
					id: triggerId,
					'aria-controls': tab.id,
					'aria-selected': String(isSelected),
					tabindex: isSelected ? '0' : '-1',
				},
				[tab.label],
			)
		})

		const tablist = new Tag('div', { role: 'tablist' }, tablistButtons)

		const tabpanels = tabs.map((tab, index) => {
			const isSelected = index === 0
			const triggerId = tab.id.replace('panel_', 'trigger_')
			const attributes: Record<string, string> = {
				role: 'tabpanel',
				id: tab.id,
				'aria-labelledby': triggerId,
			}

			if (!isSelected) {
				attributes.hidden = ''
			}

			return new Tag('div', attributes, [tab.content])
		})

		return new Tag('module-tabgroup', node.attributes, [tablist, ...tabpanels])
	},
}

export default tabgroup
