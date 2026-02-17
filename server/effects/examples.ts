import { createEffect, match } from '@zeix/cause-effect'
import { codeToHtml } from 'shiki'
import { EXAMPLES_DIR } from '../config'
import {
	componentMarkup,
	componentScripts,
	componentStyles,
	type FileInfo,
} from '../file-signals'
import { writeFileSafe } from '../io'
import { type PanelType, tabGroup } from '../templates/fragments'

const highlightCode = async (content: string, type: string) =>
	await codeToHtml(content, {
		lang: type,
		theme: 'monokai',
	})

const generatePanels = async (
	html: FileInfo,
	css?: FileInfo,
	ts?: FileInfo,
) => {
	const panels = [
		{
			type: 'html',
			label: 'HTML',
			filePath: html.path,
			content: await highlightCode(html.content, 'html'),
			selected: false,
		},
		css && {
			type: 'css',
			label: 'CSS',
			filePath: css.path,
			content: await highlightCode(css.content, 'css'),
			selected: false,
		},
		ts && {
			type: 'ts',
			label: 'TypeScript',
			filePath: ts.path,
			content: await highlightCode(ts.content, 'typescript'),
			selected: false,
		},
	].filter(Boolean) as PanelType[]

	// Select the last panel by default (typically TypeScript)
	panels[panels.length - 1].selected = true

	return panels
}

// Build a path-keyed lookup from a FileInfo array
const toPathMap = (files: FileInfo[]): Map<string, FileInfo> => {
	const map = new Map<string, FileInfo>()
	for (const file of files) map.set(file.path, file)
	return map
}

export const examplesEffect = () =>
	createEffect(() => {
		match(
			[
				componentMarkup.sources,
				componentStyles.sources,
				componentScripts.sources,
			],
			{
				ok: async ([htmlFiles, cssFiles, tsFiles]) => {
					try {
						console.log('🔄 Rebuilding example fragments...')

						const cssMap = toPathMap(cssFiles)
						const tsMap = toPathMap(tsFiles)

						for (const html of htmlFiles) {
							// Only process main component HTML files (examples/component-name/component-name.html)
							// Skip test files and other auxiliary HTML files
							const pathParts = html.path.split('/')

							if (pathParts.length < 3) {
								continue // Skip files not in component directories
							}

							const componentName = pathParts[pathParts.length - 2] // Get directory name
							const fileName = pathParts[pathParts.length - 1].replace(
								/\.html$/,
								'',
							) // Get file name without extension

							// Skip if filename doesn't match component directory name
							if (componentName !== fileName) {
								continue
							}

							const name = html.path.replace(/\.html$/, '')
							const css = cssMap.get(name + '.css')
							const ts = tsMap.get(name + '.ts')

							const panels = await generatePanels(html, css, ts)
							const outputPath = `${EXAMPLES_DIR}/${componentName}.html`
							await writeFileSafe(outputPath, tabGroup(componentName, panels))
						}

						console.log('Example fragments successfully rebuilt')
						return
					} catch (error) {
						console.error('Example fragments failed to rebuild:', String(error))
					}
				},
				err: errors => {
					console.error('Error in examples effect:', errors[0].message)
				},
			},
		)
	})
