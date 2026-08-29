import { ASSETS_DIR, TS_FILE, TSRX_TEST_FILE } from '../config'
import {
	componentScripts,
	docsScripts,
	generatedClientScripts,
	libraryScripts,
} from '../file-signals'
import { createBuildEffect, runCommand } from './build-effect'

export const jsEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'JS assets',
		[
			docsScripts.sources,
			libraryScripts.sources,
			componentScripts.sources,
			// LT-091: migrated components' generated clients are bundle inputs
			// — a recompiled client must re-trigger the bundle.
			generatedClientScripts.sources,
		],
		async () => {
			console.log('🔧 Rebuilding JS assets...')
			// Any local invocation (`bun run dev`, `serve:docs`,
			// `build:docs` run by hand) builds with DEV_MODE=true, so
			// debug instrumentation and other DEV_MODE-gated
			// diagnostics are live during development. GitHub Actions
			// sets CI=true automatically — the one signal that
			// reliably distinguishes a real CI run (the published
			// site's `build:docs`) from any local workflow. Keying off
			// NODE_ENV alone previously missed `serve:docs`, which
			// never sets it, and so always shipped PROD assets even
			// when run locally.
			const devMode = process.env.CI !== 'true'
			await runCommand([
				'bun',
				'build',
				TS_FILE,
				TSRX_TEST_FILE,
				'--outdir',
				`${ASSETS_DIR}/`,
				'--minify',
				'--define',
				`process.env.DEV_MODE="${devMode}"`,
				'--sourcemap=external',
			])
			console.log('JS successfully rebuilt')
		},
		onRebuild,
	)
