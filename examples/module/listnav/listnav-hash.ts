/**
 * Hash ↔ option-value conversions for module-listnav (LT-107). Pure string
 * functions over the listbox's first option value, so the compiled
 * component's client imports them and `module-listnav.test.ts` tests the
 * same code the page serves.
 */

/**
 * Extract the base path (first path segment) and extension from an option value.
 * "./examples/form-combobox.html" → { base: "./examples/", ext: ".html" }
 * "./api/functions/defineComponent.html" → { base: "./api/", ext: ".html" }
 */
export const getBasePath = (
	firstOptionValue: string,
): { base: string; ext: string } | null => {
	if (!firstOptionValue) return null

	const value = firstOptionValue
	// Handle relative paths starting with "./"
	if (!value.startsWith('./')) return null

	// Find the second slash to get the first path segment: "./examples/"
	const secondSlash = value.indexOf('/', 2)
	if (secondSlash === -1) return null

	return {
		base: value.slice(0, secondSlash + 1),
		ext: value.slice(value.lastIndexOf('.')),
	}
}

/**
 * Derive the option value from a location hash.
 * "#functions/defineComponent" → "./api/functions/defineComponent.html"
 * "#form-combobox" → "./examples/form-combobox.html"
 */
export const hashToValue = (
	hash: string,
	firstOptionValue: string,
): string | null => {
	if (!hash) return null
	const fragment = hash.slice(1)
	if (!fragment) return null

	const paths = getBasePath(firstOptionValue)
	if (!paths) return null

	return `${paths.base}${fragment}${paths.ext}`
}

/**
 * Derive a hash fragment from an option value.
 * "./api/functions/defineComponent.html" → "functions/defineComponent"
 * "./examples/form-combobox.html" → "form-combobox"
 */
export const valueToHash = (
	value: string,
	firstOptionValue: string,
): string => {
	if (!value) return ''

	const paths = getBasePath(firstOptionValue)
	if (!paths) return ''

	let hash = value
	if (hash.startsWith(paths.base)) hash = hash.slice(paths.base.length)
	const dotIndex = hash.lastIndexOf('.')
	if (dotIndex > 0) hash = hash.slice(0, dotIndex)

	return hash
}
