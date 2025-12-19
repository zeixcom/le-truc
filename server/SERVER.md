# Development Server with Hot Module Replacement

The Le Truc development server provides a unified serving solution for documentation, component testing, and development with integrated Hot Module Replacement (HMR) for live reloading.

## Overview

The server system combines multiple serving modes into a single, flexible solution that automatically adapts based on routes and environment variables. It supports documentation serving, component testing, and full development workflows with live reloading.

## Quick Start

```bash
# Full development server with HMR
bun run dev

# Basic production-like server
bun run serve

# Documentation server with build
bun run serve:docs

# Examples server for testing (Playwright)
bun run serve:examples
```

## Server Scripts

### Development Scripts

#### `bun run dev`
**Full Development Server with HMR**
```bash
NODE_ENV=development bun --watch server/dev.ts
```

**Use when:**
- Active development of components, documentation, or examples
- You want automatic rebuilding and live reloading
- Working on the build system or server code

**Features:**
- ✅ Hot Module Replacement (HMR)
- ✅ File watching and automatic rebuilds
- ✅ WebSocket-based live reloading
- ✅ Build error display in browser
- ✅ Automatic server restart on code changes

**What it does:**
1. Starts the build system in watch mode
2. Monitors `src/`, `examples/`, `docs-src/`, etc. for changes
3. Rebuilds automatically when files change
4. Serves content with HMR script injection
5. Broadcasts reload signals to connected browsers

### Serving Scripts

#### `bun run serve`
**Basic Production-like Server**
```bash
bun server/serve.ts
```

**Use when:**
- Testing production-like behavior
- Serving pre-built content without development features
- Quick server startup without build watching

**Features:**
- ❌ No HMR or live reloading
- ❌ No file watching
- ❌ No automatic rebuilds
- ✅ Fast startup
- ✅ Production-like serving

#### `bun run serve:docs`
**Documentation Server with Build**
```bash
bun server/serve.ts --mode docs --build-first
```

**Use when:**
- Serving documentation site
- Need to build docs before serving
- Production documentation deployment

**Features:**
- ✅ Runs build before starting server
- ❌ No HMR (unless NODE_ENV=development)
- ✅ Documentation-specific configuration
- ✅ One-time build execution

#### `bun run serve:examples`
**Examples Server for Testing**
```bash
bun run build:examples && PLAYWRIGHT=1 bun server/serve.ts
```

**Use when:**
- Running Playwright tests
- Need stable server without HMR interference
- Testing examples in isolation

**Features:**
- ✅ Builds examples first
- ❌ HMR explicitly disabled (`PLAYWRIGHT=1`)
- ❌ No file watching
- ✅ Test-optimized serving

### Testing Scripts

#### `bun run test`
**Run All Component Tests**
```bash
bunx playwright test examples
```

**Use when:**
- Running full test suite
- CI/CD pipeline execution
- Comprehensive testing before releases

#### `bun run test:component <component-name>`
**Run Individual Component Tests**
```bash
bun scripts/test-component.js <component-name>
```

**Use when:**
- Developing or debugging a specific component
- Faster feedback during development
- Focused testing on component changes

**Examples:**
```bash
# Test specific components
bun run test:component module-carousel
bun run test:component basic-hello
bun run test:component form-combobox

# With Playwright options
bun run test:component module-carousel --headed --debug
bun run test:component basic-hello -- --reporter=html

# List available components
bun run test:component --help
```

**Features:**
- ✅ Auto-discovery of component tests
- ✅ Helpful error messages with suggestions
- ✅ Pass-through of Playwright arguments
- ✅ Lists all available components

## Server Architecture

### Route Handling

The server handles multiple route patterns:

| Route Pattern | Purpose | Example |
|---------------|---------|---------|
| `/api/status` | Server health check | Health monitoring |
| `/assets/:file` | Static assets | CSS, JS, images |
| `/sources/:component` | Component source code | Example files |
| `/:component/:file` | Component mock files | `/module-lazyload/simple-text.html` |
| `/test/:component/mocks/:mock` | Test mock files | Test resources |
| `/test/:component` | Component test pages | Interactive testing |
| `/:page` | Documentation pages | Static content |
| `/` | Index page | Home page |

### File Serving

The server uses a `handleStaticFile` function that:
- Checks file existence before serving
- Returns proper 404 responses for missing files
- Injects HMR scripts in development mode for HTML files
- Handles proper MIME types and caching headers

### Component Mock File Resolution

Special handling for component mock files with fallback patterns:
- Direct path: `/test/component/mocks/file.html`
- Fallback pattern: `/component/file.html` → `component/mocks/file.html`

This allows tests to request `/module-lazyload/simple-text.html` and automatically resolve to `examples/module-lazyload/mocks/simple-text.html`.

## Hot Module Replacement (HMR)

### HMR System Components

#### WebSocket Server
- **Endpoint**: `/ws`
- **Protocol**: JSON messages over WebSocket
- **Client Management**: Tracks connected browsers
- **Broadcasting**: Sends reload signals to all clients

#### File Watching
- **Directories**: `src/`, `examples/`, `docs-src/`, `server/layouts/`, etc.
- **Recursive**: Watches subdirectories automatically
- **Debouncing**: Prevents excessive rebuilds from rapid changes
- **Cache Clearing**: Invalidates layout cache on template changes

#### Client Script Injection
- **Automatic**: Injected into HTML responses in development
- **Conditional**: Only when `NODE_ENV !== 'production'` and `!PLAYWRIGHT`
- **Placement**: Before `</head>` or `</body>` tags

### HMR Configuration

The HMR client is configured with:
```typescript
hmrScriptTag({
  enableLogging: true,          // Console logging for debugging
  maxReconnectAttempts: 10,     // Connection retry limit
  reconnectInterval: 1000,      // Base reconnection delay (ms)
  pingInterval: 30000,          // Keep-alive ping frequency (ms)
})
```

### HMR Message Protocol

#### Server → Client Messages
```json
// Simple reload trigger
"reload"

// Structured messages
{"type": "build-success"}
{"type": "build-error", "message": "Error details"}
{"type": "file-changed", "path": "src/component.ts"}
{"type": "pong"}  // Keep-alive response
```

#### Client → Server Messages
```json
{"type": "ping"}  // Keep-alive request
```

### HMR Client Features

- **Auto-reconnection**: Exponential backoff on connection loss
- **Error Display**: Shows build errors directly in browser
- **Keep-alive**: Prevents connection drops with ping-pong
- **Debug API**: Exposes `window.__HMR__` for debugging
- **Visibility Handling**: Reconnects when tab becomes active

## Environment Variables

### `NODE_ENV`
- `development` - Enables HMR, file watching, debug features
- `production` - Disables HMR, optimizes for serving
- `undefined` - Defaults to production-like behavior

### `PLAYWRIGHT=1`
- Explicitly disables HMR even in development
- Used by test runner for stability
- Prevents WebSocket connections and script injection

### `DEBUG=1`
- Enables verbose logging
- Shows detailed file watching events
- Useful for debugging build and server issues

## Command Line Arguments

### `--mode docs`
- Configures server for documentation serving
- May enable doc-specific features in the future

### `--build-first`
- Runs a complete build before starting the server
- Useful for ensuring fresh content
- Blocks server startup until build completes

## Development Workflow

### Which Script to Use?

```
Are you actively developing?
├── Yes: Use `bun run dev`
│   └── Need full development experience with HMR
│
└── No: Continue...
    │
    Are you running tests?
    ├── Yes: Use `bun run serve:examples` (via `bun run test`)
    │   └── Stable server without HMR interference
    │
    └── No: Continue...
        │
        Are you serving documentation?
        ├── Yes: Use `bun run serve:docs`
        │   └── Builds docs and serves them
        │
        └── No: Use `bun run serve`
            └── Basic server for production-like testing
```

### Development Session

1. **Start the development server**: `bun run dev`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Edit files**: Make changes to any watched file
4. **Automatic rebuild**: Watch console for build notifications
5. **Automatic reload**: Browser refreshes when build completes

### File Watching Patterns

The development server watches:
- `src/` - Component source code
- `examples/` - Component examples and tests
- `docs-src/` - Documentation source
- `server/layouts/` - HTML layout templates
- `server/effects/` - Build system effects
- `server/templates/` - Template files
- `index.ts` - Main entry point
- `package.json` - Dependencies

## Server Configuration

### Default Ports
- Development server (`dev`): Assigned by `Bun.serve()` (typically 3000)
- All other modes: Same as development

### Custom Configuration
```bash
# Environment variables (not directly supported, modify server code)
# PORT=8080 bun run dev

# Command line arguments
bun server/serve.ts --mode docs --build-first
```

## Troubleshooting

### HMR Issues

**HMR not working**:
- Check that `NODE_ENV=development` is set
- Verify WebSocket connection in browser console
- Look for `🔥 HMR:` messages in browser console
- Ensure no firewall blocking WebSocket connections

**WebSocket connection fails**:
- Check if server is running
- Verify `/ws` endpoint is accessible
- Check browser console for connection errors

**Files not reloading**:
- Verify file is in watched directories
- Check file watcher permissions
- Look for build errors in console

### Testing Issues

**Tests failing with HMR interference**:
- Verify `PLAYWRIGHT=1` is set in test script
- Check that no HMR scripts are injected in test pages
- Look for WebSocket connection attempts in test logs

**Component tests not loading**:
- Check component HTML files exist
- Verify mock files are in correct directories
- Test direct URLs like `/test/basic-hello`

### Server Issues

**Server not starting**:
- Check for port conflicts
- Verify file permissions for watched directories
- Look for missing dependencies or TypeScript errors

**Build errors during development**:
- Build errors are displayed in the browser during development
- Check server console for detailed error messages
- File watching continues even after build failures

**Static files not found**:
- Verify file exists in expected location
- Check file permissions
- Look for 404 errors in browser network tab

## Production Deployment

### HMR in Production

- HMR is automatically disabled when `NODE_ENV !== 'production'`
- WebSocket endpoint returns 404 in production
- HMR scripts are not injected in production builds
- File watching is disabled in production

### Server Deployment

For production deployment:

```bash
# Build static assets first
bun run build:docs

# Start production server
NODE_ENV=production bun server/serve.ts --build-first

# Or serve static files with any web server
# The ./docs/ directory contains complete static site
```

## Integration with Build System

The server integrates tightly with the build system:

- **File watching**: Reuses build system file watchers
- **Build notifications**: Receives build status updates
- **Error handling**: Displays build errors in browser
- **Asset serving**: Serves generated build outputs

This integration provides a seamless development experience where code changes trigger builds, and completed builds trigger browser reloads.

## Performance Considerations

### File Watching Efficiency
- Uses native `fs.watch()` for performance
- Recursive watching with selective directory monitoring
- Debouncing prevents excessive rebuilds
- Memory efficient client connection management

### Network Efficiency
- WebSocket connections for real-time communication
- JSON message protocol for structured data
- Keep-alive pings prevent connection drops
- Automatic cleanup of disconnected clients

### Asset Serving
- Static file caching with proper headers
- Efficient file existence checking
- MIME type detection and proper responses
- Compression support for better performance

## Migration from Previous Systems

### Script Changes
- `serve:dev` → `dev` (full development server)
- `serve:production` → `serve` (basic server)
- `serve:docs` → `serve:docs` (unchanged)
- `serve:test` → `serve:examples` (for tests)

### Feature Improvements
- Unified server architecture
- Better HMR integration
- Improved error handling
- More reliable WebSocket connections
- Enhanced development experience

The new server system provides a more robust, feature-complete development environment while maintaining compatibility with existing workflows.
