import { createEffect, match, resolve } from '@zeix/cause-effect'
import { SITEMAP_FILE } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { sitemap } from '../templates/sitemap'

export const sitemapEffect = () =>
	createEffect(() => {
		match(
			resolve({
				pageInfos: docsMarkdown.pageInfos,
			}),
			{
				ok: async ({ pageInfos }): Promise<void> => {
					try {
						await writeFileSafe(SITEMAP_FILE, sitemap(pageInfos))
						console.log('Sitemap file written successfully')
					} catch (error) {
						console.error('Failed to write sitemap file:', error)
					}
				},
				err: errors => {
					console.error('Error writing sitemap file:', String(errors[0]))
				},
			},
		)
	})
