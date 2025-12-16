import { createEffect, match, resolve } from '@zeix/cause-effect'
import { MENU_FILE } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { menu } from '../templates/menu'

export const menuEffect = () =>
	createEffect(() => {
		match(resolve({ pageInfos: docsMarkdown.pageInfos }), {
			ok: async ({ pageInfos }) => {
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
			err: errors => {
				console.error('Error in menu effect:', errors[0].message)
			},
		})
	})
