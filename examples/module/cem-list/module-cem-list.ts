import { defineComponent } from '../../..'

declare global {
	interface HTMLElementTagNameMap {
		'module-cem-list': HTMLElement
	}
}

/**
 * A catalog of custom-element declarations, rendered server-side from a
 * custom-elements-manifest by the `{% cem-list %}` Markdoc tag — the client
 * receives fully-formed `card-collapsible` markup and only needs to register
 * the tag name; `card-collapsible` and `module-tabgroup` provide all the
 * interactive behavior. A future iteration adds text/category filtering here
 * as a progressive-enhancement layer over the pre-rendered cards.
 * @demo {./docs/examples/module-cem-list.html} Interactive preview and usage examples */
export default defineComponent('module-cem-list', () => {})
