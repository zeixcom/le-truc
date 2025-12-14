import { createEffect, match, resolve } from '@zeix/cause-effect'
import { SITEMAP_FILE } from '../config'
import { markdownFiles } from '../file-signals'
import { writeFileSyncSafe } from '../io'
import { sitemap } from '../templates/sitemap'

export const sitemapEffect = () =>
	createEffect(() => {
		match(
			resolve({
				pageInfos: markdownFiles.pageInfos,
			}),
			{
				ok: ({ pageInfos }): undefined => {
					writeFileSyncSafe(SITEMAP_FILE, sitemap(pageInfos))
					console.log('Sitemap file written successfully')
				},
				err: errors => {
					console.error('Error writing sitemap file:', String(errors[0]))
				},
			},
		)
	})
