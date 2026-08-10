import { MENU_FILE } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { menu } from '../templates/menu'
import { createBuildEffect } from './build-effect'

export const menuEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Menu',
		[docsMarkdown.pageInfos],
		async ([pageInfos]) => {
			console.log(`📄 Generated ${pageInfos.length} page infos`)

			// Filter for root pages (files directly in pages directory, not in subdirectories)
			const rootPages = pageInfos.filter(
				info => !info.relativePath.includes('/'),
			)
			console.log(
				`🏠 Found ${rootPages.length} root pages out of ${pageInfos.length} total`,
			)

			if (rootPages.length > 0) {
				await writeFileSafe(MENU_FILE, menu(rootPages))
				console.log(
					`Menu file written successfully with ${rootPages.length} pages`,
				)
			} else {
				console.log('No root pages found, skipping menu generation')
			}
		},
		onRebuild,
	)
