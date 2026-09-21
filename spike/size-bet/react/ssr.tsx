/**
 * Server entry of the React side of the size bet (LT-266): render the todo
 * app to HTML and embed the initial state as a JSON payload script — the
 * hydration channel React requires on top of the markup.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ModuleTodo } from './module-todo'
import { SEED_TODOS } from './seed'

/** The JSON payload the page must ship so hydration can rebuild the state. */
export const statePayload = (todos: Array<object>): string =>
	JSON.stringify(todos)

/** SSR markup for the app, plus the JSON payload script tag. */
export function renderPage(): { html: string; json: string } {
	const html = renderToStaticMarkup(
		createElement(ModuleTodo, { initial: SEED_TODOS }),
	)
	const json = statePayload(SEED_TODOS)
	const script = `<script type="application/json" id="initial-todos">${json.replace(/</g, '\\u003c')}</script>`
	return { html: html + script, json }
}
