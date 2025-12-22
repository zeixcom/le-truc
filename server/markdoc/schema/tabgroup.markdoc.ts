import type {
	Node,
	RenderableTreeNode,
	Schema,
	ValidationError,
} from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import {
	extractTextFromNode,
	html,
	renderChildren,
	renderValidationErrors,
	STANDARD_CHILDREN,
	splitContentBySeparator,
} from '../utils'

const tabgroup: Schema = {
	render: 'module-tabgroup',
	children: STANDARD_CHILDREN,
	attributes: COMMON_ATTRIBUTES,
	validate(node: Node) {
		const errors: ValidationError[] = []
		const sections = splitContentBySeparator(node.children || [])

		if (sections.length < 2) {
			errors.push({
				id: 'tabgroup-insufficient-sections',
				level: 'critical' as const,
				message:
					'Tabgroup must contain at least 2 sections separated by horizontal rules (---)',
			})
		}

		// Validate each section
		for (let index = 0; index < sections.length; index++) {
			const section = sections[index]
			if (section.length === 0) continue

			const firstNode = section[0]
			if (firstNode.type !== 'heading' || firstNode.attributes.level !== 4) {
				errors.push({
					id: `tabgroup-section-${index}-invalid-heading`,
					level: 'error' as const,
					message: `Section ${index + 1} must start with a level 4 heading (#### Label)`,
				})
				continue
			}

			const label = firstNode.children?.map(extractTextFromNode).join('').trim()
			if (!label) {
				errors.push({
					id: `tabgroup-section-${index}-empty-label`,
					level: 'error' as const,
					message: `Section ${index + 1} heading cannot be empty`,
				})
			}
		}

		return errors
	},
	transform(node: Node, config) {
		// Process child nodes to find HR separators and collect sections
		const sections = splitContentBySeparator(node.children || [])

		// If insufficient sections, render error callout
		if (sections.length < 2) {
			return renderValidationErrors(
				[
					{
						id: 'tabgroup-insufficient-sections',
						level: 'critical',
						message:
							'Tabgroup must contain at least 2 sections separated by horizontal rules (---)',
					},
				],
				'Tabgroup Error',
			)
		}

		const tabs: { label: string; content: RenderableTreeNode[]; id: string }[] =
			[]

		for (let index = 0; index < sections.length; index++) {
			const section = sections[index]
			if (section.length === 0) continue

			// First node should be a heading
			const firstNode = section[0]
			const label = firstNode.children?.map(extractTextFromNode).join('').trim()

			// Transform the remaining content (everything except the heading)
			const contentNodes = section.slice(1)

			// Generate unique ID based on label
			const id = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')

			tabs.push({
				label,
				content: renderChildren(contentNodes),
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
