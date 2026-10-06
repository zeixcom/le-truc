import { defineConfig, devices } from '@playwright/test'

// Spike probe (LT-465): static pages via setContent, no server.
export default defineConfig({
	testDir: '.',
	testMatch: '*.probe.ts',
	reporter: [['list']],
	projects: [
		{ name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'WebKit', use: { ...devices['Desktop Safari'] } },
	],
})
