/**
 * JSX typing for the custom-element shells the React twins render so the
 * served DOM matches the Le Truc side's markup. React 19 keeps JSX under
 * the react module — the shells augment `react/jsx-runtime`'s
 * IntrinsicElements table.
 */
import 'react'

type ShellElement = React.DetailedHTMLProps<
	React.HTMLAttributes<HTMLElement>,
	HTMLElement
>

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			'basic-button': ShellElement
			'basic-pluralize': ShellElement
			'form-checkbox': ShellElement
			'form-inplace-edit': ShellElement & { editing?: boolean }
			'form-radiogroup': ShellElement
			'form-textbox': ShellElement
			'module-todo': ShellElement
		}
	}
}
