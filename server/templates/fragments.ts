/**
 * Fragment Templates
 *
 * Tagged template literals for generating component fragment HTML.
 * Used by the fragment plugin to create tabbed interfaces for components.
 */

import { createValidator, html } from './utils'

export interface PanelType {
	type: 'html' | 'css' | 'js' | 'ts'
	label: string
	filePath: string
	content: string
	selected: boolean
}

export interface TabButtonProps {
	name: string
	panel: PanelType
}

export interface TabPanelProps {
	name: string
	panel: PanelType
}

export interface TabGroupProps {
	name: string
	panels: PanelType[]
}

/**
 * Generate a single tab button for the tabbed interface
 */
export function tabButton({ name, panel }: TabButtonProps): string {
	return html` <button
		type="button"
		role="tab"
		id="trigger_${name}_${panel.type}"
		aria-controls="panel_${name}_${panel.type}"
		aria-selected="${String(panel.selected)}"
		tabindex="${panel.selected ? '0' : '-1'}"
	>
		${panel.label}
	</button>`
}

/**
 * Generate a single tab panel with syntax-highlighted code
 */
export function tabPanel({ name, panel }: TabPanelProps): string {
	const hidden = panel.selected ? '' : ' hidden'

	return html` <div
		role="tabpanel"
		id="panel_${name}_${panel.type}"
		aria-labelledby="trigger_${name}_${panel.type}"
		${hidden}
	>
		<module-codeblock
			language="${panel.type}"
			copy-success="Copied!"
			copy-error="Error trying to copy to clipboard!"
		>
			<p class="meta">
				<span class="file">${name}.${panel.type}</span>
				<span class="language">${panel.type}</span>
			</p>
			<module-scrollarea orientation="horizontal">
				${panel.content}
			</module-scrollarea>
			<basic-button class="copy">
				<button type="button" class="secondary small">
					<span class="label">Copy</span>
				</button>
			</basic-button>
		</module-codeblock>
	</div>`
}

/**
 * Generate tab list (buttons only)
 */
export function tabList(name: string, panels: PanelType[]): string {
	return html` <div role="tablist">
		${panels.map(panel => tabButton({ name, panel }))}
	</div>`
}

/**
 * Generate multiple tab panels
 */
export function tabPanels(name: string, panels: PanelType[]): string {
	return panels.map(panel => tabPanel({ name, panel })).join('\n')
}

/**
 * Enhanced tab group with better accessibility and structure
 */
export function tabGroup(name: string, panels: PanelType[]): string {
	if (panels.length === 0) {
		return html`<div class="no-content">No component files available</div>`
	}

	return html` <module-tabgroup>
		${tabList(name, panels)} ${tabPanels(name, panels)}
	</module-tabgroup>`
}

/**
 * Generate component fragment info structure for debugging
 */
export function componentInfo(
	name: string,
	panels: PanelType[],
	totalFiles: number,
): string {
	return html` <!-- Component: ${name} -->
		<!-- Files: ${totalFiles} -->
		<!-- Panels: ${panels.map(p => p.type).join(', ')} -->
		<!-- Selected: ${panels.find(p => p.selected)?.type || 'none'} -->`
}

/**
 * Validate panel configuration using common validator pattern
 */
export const validatePanels = createValidator<PanelType[]>([
	panels => (panels.length === 0 ? ['No panels provided'] : []),
	panels => {
		const selectedPanels = panels.filter(p => p.selected)
		if (selectedPanels.length === 0) {
			return ['No panel is selected']
		} else if (selectedPanels.length > 1) {
			return ['Multiple panels are selected']
		}
		return []
	},
	panels => {
		const errors: string[] = []
		const types = new Set<string>()

		for (const panel of panels) {
			if (!panel.type) {
				errors.push('Panel missing type')
			}
			if (!panel.label) {
				errors.push('Panel missing label')
			}
			if (!panel.filePath) {
				errors.push('Panel missing file path')
			}
			if (types.has(panel.type)) {
				errors.push(`Duplicate panel type: ${panel.type}`)
			}
			types.add(panel.type)
		}

		return errors
	},
])
