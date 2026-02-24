/**
 * Hot Module Replacement (HMR) Template
 *
 * Template for generating HMR client-side scripts that connect to the
 * development server via WebSocket for live reloading.
 */

import { html, js, raw } from './utils'

export interface HMRConfig {
	host?: string
	port?: number
	path?: string
	maxReconnectAttempts?: number
	reconnectInterval?: number
	enableLogging?: boolean
	pingInterval?: number
}

/**
 * Generate HMR client script with WebSocket connection
 */
export function hmrClient(config: HMRConfig = {}): string {
	const {
		host = 'window.location.host',
		path = '/ws',
		maxReconnectAttempts = 5,
		reconnectInterval = 1000,
		enableLogging = true,
		pingInterval = 30000,
	} = config

	const hostExpression =
		typeof host === 'string' && host.includes('window.location')
			? host
			: `'${host}'`

	const log = enableLogging
		? (message: string, ...args: any[]) =>
				`console.log('🔥 HMR:', '${message}', ${args.map(arg => (typeof arg === 'string' ? `'${arg}'` : arg)).join(', ')})`
		: () => ''

	const warn = enableLogging
		? (message: string, ...args: any[]) =>
				`console.warn('🔥 HMR:', '${message}', ${args.map(arg => (typeof arg === 'string' ? `'${arg}'` : arg)).join(', ')})`
		: () => ''

	const error = enableLogging
		? (message: string, ...args: any[]) =>
				`console.error('🔥 HMR:', '${message}', ${args.map(arg => (typeof arg === 'string' ? `'${arg}'` : arg)).join(', ')})`
		: () => ''

	return js`
(function () {
	'use strict';

	${enableLogging ? log('Client initialized') : ''}

	const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + ${hostExpression} + '${path}';
	let ws = null;
	let reconnectAttempts = 0;
	let reconnectTimer = null;
	let pingTimer = null;

	function connect() {
		try {
			ws = new WebSocket(wsUrl);
			setupEventListeners();
		} catch (err) {
			${error('Failed to create WebSocket connection', 'err')}
			scheduleReconnect();
		}
	}

	function setupEventListeners() {
		ws.onopen = function () {
			${enableLogging ? log('Connected to dev server') : ''}
			reconnectAttempts = 0;
			clearTimeout(reconnectTimer);
			startPing();
		};

		ws.onmessage = function (event) {
			handleMessage(event.data);
		};

		ws.onclose = function () {
			${enableLogging ? log('Disconnected from dev server') : ''}
			stopPing();
			scheduleReconnect();
		};

		ws.onerror = function (error) {
			${error('WebSocket error', 'error')}
		};
	}

	function handleMessage(data) {
		if (data === 'reload') {
			${enableLogging ? log('Reloading page...') : ''}
			window.location.reload();
			return;
		}

		try {
			const message = JSON.parse(data);

			switch (message.type) {
				case 'pong':
					// Keep-alive response, no action needed
					break;
				case 'build-error':
					${error('Build error', 'message.message')}
					showBuildError(message.message);
					break;
				case 'build-success':
					${enableLogging ? log('Build successful') : ''}
					hideBuildError();
					break;
				case 'file-changed':
					${enableLogging ? log('File changed', 'message.path') : ''}
					// Could implement selective reloading here
					window.location.reload();
					break;
				default:
					${enableLogging ? warn('Unknown message type', 'message.type') : ''}
			}
		} catch (err) {
			// Ignore non-JSON messages
		}
	}

	function scheduleReconnect() {
		if (reconnectAttempts >= ${maxReconnectAttempts}) {
			${error('Max reconnection attempts reached. Please refresh manually.')}
			return;
		}

		reconnectAttempts++;
		const delay = ${reconnectInterval} * Math.pow(2, Math.min(reconnectAttempts - 1, 4));

		${enableLogging ? log('Attempting to reconnect in', 'delay + "ms"') : ''}

		reconnectTimer = setTimeout(() => {
			connect();
		}, delay);
	}

	function startPing() {
		if (${pingInterval} > 0) {
			pingTimer = setInterval(() => {
				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'ping' }));
				}
			}, ${pingInterval});
		}
	}

	function stopPing() {
		if (pingTimer) {
			clearInterval(pingTimer);
			pingTimer = null;
		}
	}

	function showBuildError(message) {
		// Try to find existing error display element
		let errorElement = document.querySelector('.hmr-build-error');

		if (!errorElement) {
			errorElement = document.createElement('div');
			errorElement.className = 'hmr-build-error';
			errorElement.style.cssText = [
				'position: fixed',
				'top: 0',
				'left: 0',
				'right: 0',
				'background: #dc3545',
				'color: white',
				'padding: 1rem',
				'font-family: monospace',
				'font-size: 0.875rem',
				'z-index: 999999',
				'white-space: pre-wrap',
				'border-bottom: 3px solid #c82333'
			].join(';');

			document.body.insertBefore(errorElement, document.body.firstChild);
		}

		errorElement.textContent = '🚨 Build Error:\\n' + message;
	}

	function hideBuildError() {
		const errorElement = document.querySelector('.hmr-build-error');
		if (errorElement) {
			errorElement.remove();
		}
	}

	// Handle page visibility changes to reconnect when tab becomes active
	document.addEventListener('visibilitychange', function() {
		if (!document.hidden && (!ws || ws.readyState === WebSocket.CLOSED)) {
			${enableLogging ? log('Page became visible, attempting to reconnect') : ''}
			reconnectAttempts = 0;
			connect();
		}
	});

	// Start initial connection
	connect();

	${
		enableLogging
			? `// Expose HMR API for debugging
	window.__HMR__ = {
		connect,
		disconnect: () => {
			if (ws) {
				ws.close();
			}
			stopPing();
			clearTimeout(reconnectTimer);
		},
		status: () => ws ? ws.readyState : 'not connected',
		reconnect: () => {
			reconnectAttempts = 0;
			connect();
		}
	};`
			: ''
	}
})();
`
}

/**
 * Generate minimal HMR script for production/testing
 */
export function hmrClientMinimal(): string {
	return js`
(function(){
	const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
	ws.onmessage=e=>e.data==='reload'&&location.reload();
	ws.onclose=()=>setTimeout(()=>location.reload(),1000);
})();
`
}

/**
 * Generate HMR script as HTML script tag
 */
export function hmrScriptTag(config?: HMRConfig): string {
	return html`<script>
		${raw(hmrClient(config))}
	</script>`
}

/**
 * Generate HMR script with custom WebSocket endpoint
 */
export function hmrClientWithEndpoint(
	wsUrl: string,
	config: Omit<HMRConfig, 'host' | 'path'> = {},
): string {
	return hmrClient({
		...config,
		host: `'${wsUrl}'.replace('ws://', '').replace('wss://', '')`,
		path: '',
	})
}
