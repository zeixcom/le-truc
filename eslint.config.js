import pluginJs from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
	// Global ignores to prevent warnings about these files
	{
		ignores: [
			'index.js',
			'index.dev.js',
			'types/**/*.d.ts',
			'docs/assets/**/*.js',
			'**/*.min.js',
		],
	},
	// Base configuration for all files
	{
		files: [
			'index.ts',
			'index.dev.ts',
			'src/**/*.{js,mjs,cjs,ts}',
			'docs-src/**/*.{js,mjs,cjs,ts}',
		],
		languageOptions: { globals: globals.browser },
		...pluginJs.configs.recommended,
	},
	// TypeScript configuration
	...tseslint.configs.recommended.map(config => ({
		...config,
		files: [
			'index.ts',
			'index.dev.ts',
			'src/**/*.{js,mjs,cjs,ts}',
			'docs-src/**/*.{js,mjs,cjs,ts}',
		],
	})),
	// Custom rule overrides for all files
	{
		files: [
			'index.ts',
			'index.dev.ts',
			'src/**/*.{js,mjs,cjs,ts}',
			'docs-src/**/*.{js,mjs,cjs,ts}',
		],
		rules: {
			// we know what we're doing ;-)
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
]
