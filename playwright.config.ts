import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	timeout: 30 * 1000,
	expect: {
		timeout: 5000,
	},
	fullyParallel: true,
	projects: [
		{
			name: 'Chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'Firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'WebKit',
			use: { ...devices['Desktop Safari'] },
		},
	],
	webServer: {
		command: 'bun run serve:examples',
		port: 4173,
		reuseExistingServer: true,
	},
	reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
})
