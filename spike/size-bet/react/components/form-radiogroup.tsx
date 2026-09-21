/**
 * React twin of the Le Truc `form-radiogroup` corpus component (LT-266 size
 * bet) — a split-button radio group with roving tabindex. The parent owns
 * the value; arrow keys move between options, as in the twin.
 */
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

export type FormRadiogroupOption = {
	value: string
	label: string
}

export type FormRadiogroupProps = {
	/** The current value. */
	value: string
	/** The options, in order. */
	options: FormRadiogroupOption[]
	/** Called with the next value on selection. */
	onChange: (value: string) => void
	/** Accessible name for the group. */
	legend: string
}

/** A split-button radio group with roving tabindex. */
export function FormRadiogroup({
	value,
	options,
	onChange,
	legend,
}: FormRadiogroupProps) {
	const fieldsetRef = useRef<HTMLFieldSetElement>(null)

	const moveFocus = (current: string, direction: 1 | -1) => {
		const index = options.findIndex(option => option.value === current)
		const next = options[(index + direction + options.length) % options.length]
		if (!next) return
		onChange(next.value)
		fieldsetRef.current
			?.querySelector<HTMLInputElement>(`input[value="${next.value}"]`)
			?.focus()
	}

	const onKeydown = (event: KeyboardEvent, current: string) => {
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault()
			moveFocus(current, 1)
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault()
			moveFocus(current, -1)
		}
	}

	return (
		<form-radiogroup className="split-button">
			<fieldset ref={fieldsetRef}>
				<legend className="visually-hidden">{legend}</legend>
				{options.map(option => {
					const selected = option.value === value
					return (
						<label key={option.value} data-value={option.value} className={selected ? 'selected' : undefined}>
							<input
								type="radio"
								className="visually-hidden"
								value={option.value}
								checked={selected}
								tabIndex={selected ? 0 : -1}
								onChange={() => onChange(option.value)}
								onKeyDown={event => onKeydown(event, option.value)}
							/>
							<span>{option.label}</span>
						</label>
					)
				})}
			</fieldset>
		</form-radiogroup>
	)
}
