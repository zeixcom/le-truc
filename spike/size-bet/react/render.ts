/**
 * SSR render entry of the React side of the size bet (LT-266): prints the
 * rendered page and its JSON state payload to stdout as JSON, for the
 * measurement script to consume. Kept as a separate program boundary on
 * purpose — the React fixture tree type-checks under its own tsconfig (it
 * uses React's JSX table, not Le Truc's), and the repo's root program must
 * not absorb it, exactly as generated compiler output stays out of the
 * root program.
 */
import { renderPage } from './ssr'
import { SEED_TODOS } from './seed'

const { html, json } = renderPage()
console.log(
	JSON.stringify({ html, json, seed: SEED_TODOS }),
)
