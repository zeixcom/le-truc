import type {
	Node,
	RenderableTreeNode,
	Schema,
	ValidationError,
} from '@markdoc/markdoc'
import { commonAttributes } from '../markdoc-constants'
import {
	extractNavigationItem,
	extractTextFromNode,
	generateId,
	html,
	renderValidationErrors,
} from '../markdoc-helpers'

/* === Internal Functions === */

/**
 * Render navigation items with proper grouping structure for form-listbox
 */
const renderNavigationItems = (
	items: Array<{
		label: string
		src: string
		group?: string
		selected?: boolean
	}>,
) => {
	// If no item has selected attribute, mark the first one as selected
	const hasSelected = items.some(item => item.selected)
	if (!hasSelected && items.length > 0) {
		items[0].selected = true
	}

	// Group items by their group property
	const groups = new Map<
		string,
		Array<{ label: string; src: string; selected?: boolean }>
	>()
	const ungroupedItems: Array<{
		label: string
		src: string
		selected?: boolean
	}> = []

	for (const item of items) {
		if (item.group) {
			if (!groups.has(item.group)) {
				groups.set(item.group, [])
			}
			groups.get(item.group)!.push({
				label: item.label,
				src: item.src,
				selected: item.selected,
			})
		} else {
			ungroupedItems.push({
				label: item.label,
				src: item.src,
				selected: item.selected,
			})
		}
	}

	const result: Array<RenderableTreeNode | RenderableTreeNode[]> = []

	// Add ungrouped items first (if any)
	if (ungroupedItems.length > 0) {
		for (const item of ungroupedItems) {
			result.push(
				html`<button
					type="button"
					role="option"
					tabindex="${item.selected ? '0' : '-1'}"
					value="${item.src}"
					aria-selected="${String(!!item.selected)}"
				>
					${item.label}
				</button>`,
			)
		}
	}

	// Add grouped items
	for (const [groupName, groupItems] of groups) {
		const groupId = `group-${generateId()}`

		// Create group with header and options
		const groupOptions = groupItems.map(item => {
			return html`<button
				type="button"
				role="option"
				tabindex="${item.selected ? '0' : '-1'}"
				value="${item.src}"
				aria-selected="${String(!!item.selected)}"
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

/* === Exported Schema === */

const listnav: Schema = {
	render: 'module-listnav',
	children: ['list'], // Only accept list children
	attributes: {
		...commonAttributes,
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
			selected?: boolean
		}> = []

		// Process each list
		for (const list of listNodes) {
			const items = list.children?.filter(child => child.type === 'item') || []

			for (const item of items) {
				// Check if this item has a nested list (group)
				const nestedList = item.children?.find(child => child.type === 'list')

				if (nestedList) {
					// This is a group header - extract group name from direct text only
					const groupName = extractTextFromNode(item, true)

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
		const listboxId = `listnav-${generateId()}`
		const labelId = `${listboxId}-label`

		// Get the selected item's src, or use default, or first item
		const selectedItem = navigationItems.find(item => item.selected)
		const firstSrc =
			selectedItem?.src || defaultSrc || navigationItems[0]?.src || ''

		return html`<module-listnav>
			<nav>
				<h2 id="${labelId}" class="visually-hidden">${title}</h2>
				<form-listbox id="${listboxId}" value="${firstSrc}">
					<input type="hidden" name="page" />
					<label for="${listboxId}-filter" class="visually-hidden">
						Filter
					</label>
					<div class="input">
						<input
							type="text"
							id="${listboxId}-filter"
							class="filter"
							name="filter"
							value=""
							autocomplete="off"
							placeholder="Filter"
						/>
						<button
							type="button"
							class="clear"
							aria-label="Clear filter"
							hidden
						>
							✕
						</button>
					</div>
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

export default listnav
