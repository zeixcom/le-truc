/**
 * React twin of the Le Truc `form-textbox` corpus component (LT-266 size
 * bet) — a labelled text input with a clear affordance. The parent owns the
 * value (it derives the submit button's disabled state from the length) and
 * reaches the control through a ref handle (`clear()`), the React
 * counterpart of the twin's exposed `clear()` method.
 */
import {
	forwardRef,
	useImperativeHandle,
	useRef,
} from 'react'

export type FormTextboxHandle = {
	/** Empty the input and return focus to it. */
	clear: () => void
}

export type FormTextboxProps = {
	/** Field label text. */
	label: string
	/** Per-document id of the input, wired to its label. */
	inputId: string
	/** The current value, owned by the parent. */
	value: string
	/** Called with the next value on input. */
	onValueChange: (value: string) => void
	/** Whether the clear affordance is rendered. */
	clearable?: boolean
}

/** A labelled text input with a clear affordance. */
export const FormTextbox = forwardRef<FormTextboxHandle, FormTextboxProps>(
	function FormTextbox(
		{ label, inputId, value, onValueChange, clearable = false },
		ref,
	) {
		const inputRef = useRef<HTMLInputElement>(null)

		useImperativeHandle(ref, () => ({
			clear: () => {
				onValueChange('')
				inputRef.current?.focus()
			},
		}))

		return (
			<form-textbox>
				<label htmlFor={inputId}>{label}</label>
				<div className="input">
					<input
						ref={inputRef}
						id={inputId}
						type="text"
						value={value}
						onChange={event => onValueChange(event.target.value)}
					/>
					{clearable ? (
						<button
							type="button"
							className="clear"
							aria-label="Clear input"
							hidden={value === ''}
							onClick={() => onValueChange('')}
						>
							✕
						</button>
					) : null}
				</div>
			</form-textbox>
		)
	},
)
