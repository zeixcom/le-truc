import { SITEMAP_FILE } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { sitemap } from '../templates/sitemap'
import { createBuildEffect } from './build-effect'

export const sitemapEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Sitemap',
		[docsMarkdown.pageInfos],
		async ([pageInfos]) => {
			await writeFileSafe(SITEMAP_FILE, sitemap(pageInfos))
			console.log('Sitemap file written successfully')
		},
		onRebuild,
	)
