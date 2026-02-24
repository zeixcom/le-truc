import { createEffect, match } from '@zeix/cause-effect'
import { SITEMAP_FILE } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { sitemap } from '../templates/sitemap'

export const sitemapEffect = () => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => { resolve = res })
	const cleanup = createEffect(() => {
		match([docsMarkdown.pageInfos], {
			ok: async ([pageInfos]): Promise<void> => {
				try {
					await writeFileSafe(SITEMAP_FILE, sitemap(pageInfos))
					console.log('Sitemap file written successfully')
				} catch (error) {
					console.error('Failed to write sitemap file:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error writing sitemap file:', String(errors[0]))
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
