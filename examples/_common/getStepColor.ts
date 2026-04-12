import type { Oklch } from 'culori'

export const getStepColor = (base: Oklch, step: number): Oklch => {
	const exp = 2 * Math.log((1 - base.l) / base.l)
	const stepL =
		base.l !== 0.5 ? (Math.exp(exp * step) - 1) / (Math.exp(exp) - 1) : step
	const stepC =
		base.c > 0
			? (base.c * (8 * Math.sin((Math.PI * (4 * step + 1)) / 6) ** 3 - 1)) / 7
			: 0
	return { mode: 'oklch', l: stepL, c: stepC, h: base.h ?? 0 }
}
