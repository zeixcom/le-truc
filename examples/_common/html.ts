export const html = (
	strings: TemplateStringsArray,
	...values: unknown[]
): string => String.raw({ raw: strings }, ...values)
