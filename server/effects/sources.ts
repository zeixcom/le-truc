import { SOURCES_DIR } from '../config'
import {
	componentMarkup,
	componentScripts,
	componentStyles,
	type FileInfo,
} from '../file-signals'
import { highlightSnippet } from '../html-shaping'
import { getFilePath, writeFileSafe } from '../io'
import { type PanelType, tabGroup } from '../templates/fragments'
import { createBuildEffect } from './build-effect'

/* === Internal Functions === */

const toPathMap = (files: FileInfo[]): Map<string, FileInfo> => {
	const map = new Map<string, FileInfo>()
	for (const file of files) map.set(file.path, file)
	return map
}

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
			content: await highlightSnippet(html.content, 'html'),
			selected: false,
		},
		css && {
			type: 'css',
			label: 'CSS',
			filePath: css.path,
			content: await highlightSnippet(css.content, 'css'),
			selected: false,
		},
		ts && {
			type: 'ts',
			label: 'TypeScript',
			filePath: ts.path,
			content: await highlightSnippet(ts.content, 'typescript'),
			selected: false,
		},
	].filter(Boolean) as PanelType[]

	// Select the last panel by default (typically TypeScript)
	panels[panels.length - 1]!.selected = true

	return panels
}

export { generatePanels }

/* === Exported Effect === */

export const sourcesEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Source fragments',
		[
			componentMarkup.sources,
			componentStyles.sources,
			componentScripts.sources,
		],
		async ([htmlFiles, cssFiles, tsFiles]) => {
			console.log('🔄 Rebuilding source fragments...')

			const cssMap = toPathMap(cssFiles)
			const tsMap = toPathMap(tsFiles)

			for (const html of htmlFiles) {
				// Only process main component HTML files (examples/<type>/<name>/<type>-<name>.html)
				// Skip test files and other auxiliary HTML files
				const pathParts = html.path.split('/')

				if (pathParts.length < 4) continue

				const typeName = pathParts[pathParts.length - 3]!
				const dirName = pathParts[pathParts.length - 2]!
				const fileName = pathParts[pathParts.length - 1]!.replace(/\.html$/, '')

				// Skip if filename doesn't match <type>-<name> pattern
				if (fileName !== `${typeName}-${dirName}`) continue

				const componentName = fileName

				const name = html.path.replace(/\.html$/, '')
				const css = cssMap.get(name + '.css')
				const ts = tsMap.get(name + '.ts')

				const panels = await generatePanels(html, css, ts)
				const outputPath = getFilePath(SOURCES_DIR, `${componentName}.html`)
				await writeFileSafe(outputPath, tabGroup(componentName, panels))
			}

			console.log('Source fragments successfully rebuilt')
		},
		onRebuild,
	)
