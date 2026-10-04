import { defineConfig, devices } from '@playwright/test'
import {
	freePort,
	INTERACTIVE_PORT,
	servesThisCheckout,
} from './scripts/test-server'

// Test server port (LT-415). A caller that owns a server (`test:variants`)
// names it in `TEST_PORT`. Otherwise reuse a server on 3000 only when it is
// this checkout serving the default surface, else start one on a free port.
// The choice is written back to `TEST_PORT` so the workers, which re-load
// this config, inherit it instead of picking a port of their own.
const callerOwnsServer = !!process.env.TEST_PORT
const reuse = callerOwnsServer || (await servesThisCheckout(INTERACTIVE_PORT))
if (!callerOwnsServer)
	process.env.TEST_PORT = String(reuse ? INTERACTIVE_PORT : await freePort())
const port = Number(process.env.TEST_PORT)

export default defineConfig({
	testDir: './examples',
	testMatch: '**/*.spec.ts',
	timeout: 30 * 1000,
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL: `http://localhost:${port}`,
	},
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
	],
	webServer: {
		command: 'bun run serve:examples',
		port,
		env: { PORT: String(port) },
		reuseExistingServer: reuse,
	},
	reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
})
