import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './examples',
	testMatch: '**/*.spec.ts',
	timeout: 30 * 1000,
	retries: process.env.CI ? 2 : 0,
	expect: {
		timeout: 5000,
	},
	fullyParallel: true,
	projects: [
		{
			name: 'Chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		/* {
			name: 'Firefox',
			use: { ...devices['Desktop Firefox'] },
		}, */
		{
			name: 'WebKit',
			use: { ...devices['Desktop Safari'] },
		},
		// ARIA-reflection PoC (test/poc, TODO.md LT-001) — served by its own
		// lightweight server on 3100; `playwright test examples` never
		// matches these specs, `playwright test test/poc` never matches the
		// example ones.
		{
			name: 'poc-chromium',
			testDir: './test/poc',
			use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' },
		},
		{
			name: 'poc-firefox',
			testDir: './test/poc',
			use: { ...devices['Desktop Firefox'], baseURL: 'http://localhost:3100' },
		},
		{
			name: 'poc-webkit',
			testDir: './test/poc',
			use: { ...devices['Desktop Safari'], baseURL: 'http://localhost:3100' },
		},
	],
	webServer: [
		{
			command: 'bun run serve:examples',
			port: 3000,
			reuseExistingServer: true,
		},
		{
			command: 'bun test/poc/serve.ts',
			port: 3100,
			reuseExistingServer: true,
		},
	],
	reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
})
