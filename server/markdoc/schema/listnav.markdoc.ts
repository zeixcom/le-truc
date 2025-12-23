import type {
	Node,
	RenderableTreeNode,
	Schema,
	ValidationError,
} from '@markdoc/markdoc'
import { COMMON_ATTRIBUTES } from '../attributes'
import { extractTextFromNode, html, renderValidationErrors } from '../utils'

const randomId = () => Math.random().toString(36).substring(2, 9)

const listnav: Schema = {
	render: 'module-listnav',
	children: ['list'], // Only accept list children
	attributes: {
		...COMMON_ATTRIBUTES,
		title: {
			type: String,
			default: 'Navigation',
		},
		'default-src': {
			type: String,
		},
	},
	validate(node: Node) {
		const errors: ValidationError[] = []

		// Check if there's at least one list
		const listNodes =
			node.children?.filter(child => child.type === 'list') || []
		if (listNodes.length === 0) {
			errors.push({
				id: 'listnav-no-list',
				level: 'critical',
				message: 'Navigation list must contain at least one list',
			})
		}

		// Validate list structure (should have items)
		for (const list of listNodes) {
			const items = list.children?.filter(child => child.type === 'item') || []
			if (items.length === 0) {
				errors.push({
					id: 'listnav-empty-list',
					level: 'error',
					message: 'Navigation list cannot be empty',
				})
			}
		}

		return errors
	},
	transform(node: Node, config) {
		const title = node.attributes.title || 'Navigation'
		const defaultSrc = node.attributes['default-src']

		// Extract navigation items from the list
		const listNodes =
			node.children?.filter(child => child.type === 'list') || []
		const navigationItems: Array<{
			label: string
			src: string
			group?: string
		}> = []

		// Process each list
		for (const list of listNodes) {
			const items = list.children?.filter(child => child.type === 'item') || []

			for (const item of items) {
				// Check if this item has a nested list (group)
				const nestedList = item.children?.find(child => child.type === 'list')

				if (nestedList) {
					// This is a group header - extract group name from direct text only
					const groupName = extractDirectTextFromNode(item)

					// Process nested items
					const nestedItems =
						nestedList.children?.filter(child => child.type === 'item') || []
					for (const nestedItem of nestedItems) {
						const itemContent = extractNavigationItem(nestedItem)
						if (itemContent) {
							navigationItems.push({
								...itemContent,
								group: groupName,
							})
						}
					}
				} else {
					// Regular item without nesting
					const itemContent = extractNavigationItem(item)
					if (itemContent) {
						navigationItems.push(itemContent)
					}
				}
			}
		}

		// If no items found, show error
		if (navigationItems.length === 0) {
			return renderValidationErrors(
				[
					{
						id: 'listnav-no-items',
						level: 'error',
						message: 'No valid navigation items found',
					},
				],
				'Navigation List Error',
			)
		}

		// Generate unique ID for the listbox
		const listboxId = `listnav-${randomId()}`
		const labelId = `${listboxId}-label`

		// Get the first item's src or use default
		const firstSrc = defaultSrc || navigationItems[0]?.src || ''

		return html`<module-listnav>
			<nav>
				<h2 id="${labelId}" class="visually-hidden">${title}</h2>
				<form-listbox id="${listboxId}" value="${firstSrc}">
					<input type="hidden" name="page" />
					<div role="listbox" aria-labelledby="${labelId}">
						${renderNavigationItems(navigationItems)}
					</div>
				</form-listbox>
			</nav>
			<module-lazyload>
				<card-callout>
					<p class="loading" role="status">Loading...</p>
					<p class="error" role="alert" aria-live="assertive" hidden></p>
				</card-callout>
				<div class="content" hidden></div>
			</module-lazyload>
		</module-listnav>`
	},
}

/**
 * Extract navigation item (label and src) from a list item node
 */
function extractNavigationItem(itemNode: Node): {
	label: string
	src: string
} | null {
	// Look for a link in the item
	const linkNode = findLinkNode(itemNode)

	if (linkNode) {
		// Extract label from link text
		const label = extractTextFromNode(linkNode).trim()
		// Get href from link attributes
		const src = linkNode.attributes?.href || ''

		if (label && src) {
			return { label, src }
		}
	}

	// Fallback: use the entire item text as label and generate src
	const label = extractTextFromNode(itemNode).trim()
	if (label) {
		// Generate a basic src path from the label
		const src = `./examples/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`
		return { label, src }
	}

	return null
}

/**
 * Find the first link node in a tree
 */
function findLinkNode(node: Node): Node | null {
	if (node.type === 'link') {
		return node
	}

	if (node.children) {
		for (const child of node.children) {
			const found = findLinkNode(child)
			if (found) return found
		}
	}

	return null
}

/**
 * Render navigation items with proper grouping structure for form-listbox
 */
function renderNavigationItems(
	items: Array<{ label: string; src: string; group?: string }>,
) {
	// Group items by their group property
	const groups = new Map<string, Array<{ label: string; src: string }>>()
	const ungroupedItems: Array<{ label: string; src: string }> = []

	for (const item of items) {
		if (item.group) {
			if (!groups.has(item.group)) {
				groups.set(item.group, [])
			}
			groups.get(item.group)!.push({ label: item.label, src: item.src })
		} else {
			ungroupedItems.push({ label: item.label, src: item.src })
		}
	}

	const result: Array<RenderableTreeNode | RenderableTreeNode[]> = []
	let optionIndex = 0

	// Add ungrouped items first (if any)
	if (ungroupedItems.length > 0) {
		for (const item of ungroupedItems) {
			const isSelected = optionIndex === 0
			result.push(
				html`<button
					type="button"
					role="option"
					tabindex="${isSelected ? '0' : '-1'}"
					value="${item.src}"
					aria-selected="${String(isSelected)}"
				>
					${item.label}
				</button>`,
			)
			optionIndex++
		}
	}

	// Add grouped items
	for (const [groupName, groupItems] of groups) {
		const groupId = `group-${randomId()}`

		// Create group with header and options
		const groupOptions = groupItems.map(item => {
			const isSelected = optionIndex === 0
			optionIndex++
			return html`<button
				type="button"
				role="option"
				tabindex="${isSelected ? '0' : '-1'}"
				value="${item.src}"
				aria-selected="${String(isSelected)}"
			>
				${item.label}
			</button>`
		})

		result.push(
			html`<div role="group" aria-labelledby="${groupId}">
				<div role="presentation" id="${groupId}">${groupName}</div>
				${groupOptions}
			</div>`,
		)
	}

	return result
}

/**
 * Extract only direct text content from a node, not from nested children
 */
function extractDirectTextFromNode(node: Node): string {
	if (node.type === 'text') {
		return node.attributes.content || ''
	}

	// Only look at direct children, not nested lists
	if (node.children) {
		let text = ''
		for (const child of node.children) {
			if (child.type === 'text') {
				text += child.attributes.content || ''
			} else if (child.type === 'inline') {
				// Process inline content but skip lists
				text += extractDirectTextFromNode(child)
			} else if (child.type !== 'list') {
				// Include other direct children but skip lists
				text += extractTextFromNode(child)
			}
		}
		return text.trim()
	}

	return ''
}

export default listnav
