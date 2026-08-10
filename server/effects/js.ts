import { createEffect, match } from '@zeix/cause-effect'
import { ASSETS_DIR, TS_FILE } from '../config'
import { componentScripts, docsScripts, libraryScripts } from '../file-signals'

export const jsEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})
	const cleanup = createEffect(() => {
		match(
			[docsScripts.sources, libraryScripts.sources, componentScripts.sources],
			{
				ok: async () => {
					const firstRun = !!resolve
					try {
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
						const proc = Bun.spawn(
							[
								'bun',
								'build',
								TS_FILE,
								'--outdir',
								`${ASSETS_DIR}/`,
								'--minify',
								'--define',
								`process.env.DEV_MODE="${devMode}"`,
								'--sourcemap=external',
							],
							{ stdout: 'inherit', stderr: 'inherit' },
						)
						const exitCode = await proc.exited
						if (exitCode !== 0) {
							console.error(`JS rebuild failed with exit code ${exitCode}`)
						} else {
							console.log('JS successfully rebuilt')
							if (!firstRun) onRebuild?.()
						}
					} catch (error) {
						console.error('JS failed to rebuild:', String(error))
					} finally {
						resolve?.()
						resolve = undefined
					}
				},
				err: errors => {
					console.error('Error in JS effect:', errors[0]!.message)
					resolve?.()
					resolve = undefined
				},
			},
		)
	})
	return { cleanup, ready }
}
