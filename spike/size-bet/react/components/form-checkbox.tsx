/**
 * React twin of the Le Truc `form-checkbox` corpus component (LT-266 size
 * bet) — a visually-hidden checkbox whose checked state the parent owns.
 */
import type { ReactNode } from 'react'

export type FormCheckboxProps = {
	/** Whether the box is checked. */
	checked: boolean
	/** Called with the next checked state on toggle. */
	onChange: (checked: boolean) => void
	/** Content rendered beside the control (the label markup). */
	children: ReactNode
}

/** A visually-hidden checkbox whose checked state the parent owns. */
export function FormCheckbox({ checked, onChange, children }: FormCheckboxProps) {
	return (
		<form-checkbox className="todo">
			<input
				type="checkbox"
				className="visually-hidden"
				checked={checked}
				onChange={event => onChange(event.target.checked)}
			/>
			{children}
		</form-checkbox>
	)
}
