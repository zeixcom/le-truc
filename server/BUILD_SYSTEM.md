# Reactive Build System with Hot Module Replacement

A modern static site generator built with [Cause & Effect](https://github.com/zeix/cause-effect) reactive signals, [Markdoc](https://markdoc.dev/) content processing, Bun for fast builds, and integrated Hot Module Replacement for development.

## Overview

This build system uses reactive programming principles to create an efficient documentation site generator with automatic dependency tracking and live reloading. The system processes Markdown content through Markdoc schemas and generates a complete static site with syntax highlighting, interactive components, and progressive enhancement.

## Architecture

### Core Components

#### 📁 File Watcher (`file-watcher.ts`)

- **`watchFiles(directory, options)`**: Creates reactive state that automatically updates when filesystem changes occur
- Supports recursive watching, file extension filtering, and ignore patterns
- Returns `Store<Record<string, FileInfo>>` that other parts of the system can reactively depend on

#### 🔄 File Signals (`file-signals.ts`)

Defines reactive signals for different file types:

- **`pagesMarkdown`**: Tracks markdown files with Markdoc processing
  - `sources`: Raw markdown files from `./docs-src/pages/`
  - `processed`: Computed signal with extracted frontmatter and metadata
  - `pageInfos`: Computed signal generating page navigation data
  - `fullyProcessed`: Computed signal with complete Markdoc→HTML transformation

- **`libraryScripts`**: TypeScript files from `./src/` (Le Truc library source)
- **`docsScripts`**: TypeScript files from `./docs-src/` (documentation scripts)
- **`componentScripts`**: Component TypeScript from `./examples/` (component examples)
- **`templateScripts`**: Template functions from `./server/templates/`
- **`docsStyles`**: CSS files from `./docs-src/`
- **`componentStyles`**: Component CSS from `./examples/` (component examples)
- **`componentMarkup`**: HTML template files from `./examples/` (component examples)

#### ⚡ Effects (`effects/`)

Each effect reactively responds to file changes and performs specific build tasks:

1. **`apiEffect`** - Generates API documentation using TypeDoc when library source changes
2. **`cssEffect`** - Rebuilds and minifies CSS when stylesheets change
3. **`jsEffect`** - Bundles and minifies JavaScript when scripts change
4. **`serviceWorkerEffect`** - Generates service worker after assets are built
5. **`examplesEffect`** - Creates syntax-highlighted component examples from example files
6. **`menuEffect`** - Generates navigation menu from page metadata
7. **`pagesEffect`** - Processes markdown files to HTML with Markdoc schemas and template support
8. **`sitemapEffect`** - Creates XML sitemap for SEO

#### 📄 Markdoc Schemas (`schema/`)

Custom Markdoc schemas for rich content:

- **`carousel.markdoc.ts`** - Interactive carousels with slides (`{% carousel %}`)
- **`slide.markdoc.ts`** - Individual carousel slides (`{% slide %}`)
- **`fence.markdoc.ts`** - Enhanced code blocks with syntax highlighting
- **`heading.markdoc.ts`** - Headings with automatic anchor links
- **`callout.markdoc.ts`** - Warning/info/tip callout boxes
- **`demo.markdoc.ts`** - Interactive code demonstrations
- **`tabgroup.markdoc.ts`** - Tabbed content interfaces
- **`hero.markdoc.ts`** - Hero sections with table of contents
- **`section.markdoc.ts`** - Content sections with styling
- **`source.markdoc.ts`** - Lazy-loaded source code examples

#### 🛠️ Markdoc Helpers (`markdoc-helpers.ts`)

Shared utilities for schema development:

- **Common attributes**: `classAttribute`, `idAttribute`, `styleAttribute`
- **Children definitions**: `standardChildren`, `richChildren`
- **Text processing**: `extractTextFromNode()`, `transformChildrenWithConfig()`
- **HTML generation**: `createNavigationButton()`, `createTabButton()`, `createAccessibleHeading()`
- **Utilities**: `generateUniqueId()`, `splitContentBySeparator()`

### Reactive Flow with HMR Integration

```
File Changes → File Signals → Markdoc Processing → Effects → Output Files → HMR Broadcast
```

1. **File Watcher** detects changes and updates reactive state
2. **Computed Signals** automatically recalculate derived data
3. **Markdoc Processing** transforms markdown with custom schemas
4. **Effects** trigger when their dependencies change
5. **Build Outputs** are generated only when necessary
6. **HMR System** broadcasts reload signals to connected browsers

## Hot Module Replacement System

### HMR Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   File Watcher  │───▶│  Build System   │───▶│   HMR Server    │
│  (Node.js fs)   │    │  (server/build) │    │ (WebSocket API) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                     │
         │                      │                     ▼
         │                      │             ┌─────────────────┐
         │                      │             │  Browser Client │
         │                      │             │   (HMR Script)  │
         │                      │             └─────────────────┘
         │                      │                     │
         ▼                      ▼                     ▼
┌───────────────────────────────────────────────────────────────┐
│                         Live Reload                           │
└───────────────────────────────────────────────────────────────┘
```

### HMR Components

#### Server-side (`server/serve.ts`)
- **WebSocket Endpoint**: `/ws` for HMR communication
- **File Watching**: Monitors `src/`, `examples/`, `docs-src/`, etc.
- **Client Management**: Tracks connected HMR clients
- **Message Broadcasting**: Sends reload signals to all clients

#### Build System Integration (`server/build.ts`)
- **Watch Mode**: Continuous rebuilding on file changes
- **Error Handling**: Broadcasts build errors to clients
- **HMR Integration**: Notifies server of build status

#### Client-side (`server/templates/hmr.ts`)
- **WebSocket Client**: Connects to `/ws` endpoint
- **Auto-reconnection**: Handles connection drops
- **Error Display**: Shows build errors in browser
- **Page Reloading**: Triggers reload on file changes

#### Development Server (`server/dev.ts`)
- **Unified Interface**: Combines build system and server
- **Process Management**: Handles graceful shutdown
- **Environment Setup**: Configures development mode

### HMR Configuration

```typescript
// HMR Client Options
hmrScriptTag({
  enableLogging: true,          // Console logging
  maxReconnectAttempts: 10,     // Reconnection limit
  reconnectInterval: 1000,      // Base reconnect delay (ms)
  pingInterval: 30000,          // Keep-alive interval (ms)
})
```

### HMR Messages

#### Server to Client:
```json
// Reload trigger
"reload"

// Build status
{"type": "build-success"}
{"type": "build-error", "message": "Error details"}

// File changes
{"type": "file-changed", "path": "src/component.ts"}

// Keep-alive
{"type": "pong"}
```

#### Client to Server:
```json
// Keep-alive ping
{"type": "ping"}
```

## Build Scripts and Development Workflow

### Available Scripts

| Script | Command | Purpose | HMR | File Watching | Build First |
|--------|---------|---------|-----|---------------|-------------|
| **`dev`** | `NODE_ENV=development bun --watch server/dev.ts` | Full development with HMR | ✅ | ✅ | ✅ |
| **`build:docs`** | `bun ./server/build.ts` | Single build | ❌ | ❌ | N/A |
| **`build:docs:watch`** | `bun ./server/build.ts --watch` | Build with watching | ❌ | ✅ | N/A |

### Development Workflow

#### Starting Development

```bash
# Full development server with HMR (recommended)
bun run dev

# Build with file watching (no server)
bun run build:docs:watch

# Single build
bun run build:docs
```

#### File Watching Patterns

The development server watches these directories:
- `src/` - Component source code
- `examples/` - Component examples and tests
- `docs-src/` - Documentation source
- `server/layouts/` - HTML layout templates
- `server/effects/` - Build system effects
- `server/templates/` - Template files
- `index.ts` - Main entry point
- `package.json` - Dependencies

#### Development Session

1. **Start the development server**: `bun run dev`
2. **Open browser**: Navigate to `http://localhost:3000` (or configured port)
3. **Edit files**: Make changes to any watched file
4. **Automatic rebuild**: Watch console for build notifications
5. **Automatic reload**: Browser refreshes when build completes

### Environment Variables

#### `NODE_ENV`
- `development` - Enables HMR, file watching, debug features
- `production` - Disables HMR, optimizes for serving
- `undefined` - Defaults to production-like behavior

#### `PLAYWRIGHT=1`
- Explicitly disables HMR even in development
- Used by test runner for stability
- Prevents WebSocket connections and script injection

#### `DEBUG=1`
- Enables verbose logging
- Shows detailed file watching events
- Useful for debugging build and server issues

## Markdoc Content System

### Supported Content Types

The system supports rich content through Markdoc schemas:

```markdown
# Standard Markdown
- Lists, links, **bold**, *italic*, `code`
- Code blocks with syntax highlighting

# Custom Components
{% carousel %}
{% slide title="Slide Title" style="background: var(--color-green-20);" %}
Your slide content here...
{% /slide %}
{% /carousel %}

{% callout class="tip" title="Pro Tip" %}
This creates a styled callout box.
{% /callout %}

{% demo %}
<button>Interactive demo</button>
---
This creates an interactive demonstration.
{% /demo %}
```

### Code Block Features

Enhanced code blocks with automatic:
- **Syntax highlighting** (powered by Shiki)
- **Copy buttons** with success/error feedback
- **Language labels** and optional filenames
- **Expand/collapse** for long code blocks (>10 lines)

```markdown
```js#example.js
function hello(name) {
    console.log(`Hello, ${name}!`);
}
``
```

### Schema Architecture

Schemas use common utilities for consistency:

```typescript
import { commonAttributes, standardChildren, transformChildrenWithConfig } from '../markdoc-helpers'

const mySchema: Schema = {
    render: 'my-component',
    children: standardChildren,
    attributes: commonAttributes,
    transform(node: Node) {
        const content = transformChildrenWithConfig(node.children || [])
        return new Tag('my-component', node.attributes, content)
    }
}
```

## Dependencies Tracked

### Direct File Dependencies

| Signal             | Watches                  | Extensions | Recursive | Purpose                   |
| ------------------ | ------------------------ | ---------- | --------- | ------------------------- |
| `pagesMarkdown`    | `./docs-src/pages/`      | `.md`      | ✅        | Site content and API docs |
| `libraryScripts`   | `./src/`                 | `.ts`      | ✅        | Library source code       |
| `docsScripts`      | `./docs-src/`            | `.ts`      | 🛑        | Documentation scripts     |
| `componentScripts` | `./examples/`            | `.ts`      | ✅        | Component logic           |
| `templateScripts`  | `./server/templates/`    | `.ts`      | ✅        | Template functions        |
| `docsStyles`       | `./docs-src/`            | `.css`     | 🛑        | Main stylesheets          |
| `componentStyles`  | `./examples/`            | `.css`     | ✅        | Component styles          |
| `componentMarkup`  | `./examples/`            | `.html`    | ✅        | Component templates       |

### Effect Dependencies

| Effect                | Depends On                                                                       | Triggers When                              |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| `apiEffect`           | `libraryScripts.sources`                                                         | Library TypeScript files change            |
| `cssEffect`           | `docsStyles.sources`, `componentStyles.sources`                                  | Any CSS files change                       |
| `jsEffect`            | `docsScripts.sources`, `libraryScripts.sources`, `componentScripts.sources`      | Any TypeScript files change                |
| `serviceWorkerEffect` | All style and script sources                                                     | CSS/JS source files change                 |
| `examplesEffect`      | `componentMarkup.sources`, `componentStyles.sources`, `componentScripts.sources` | Component files change                     |
| `pagesEffect`         | `pagesMarkdown.fullyProcessed`                                                   | Markdown files or their processing changes |
| `menuEffect`          | `pagesMarkdown.pageInfos`                                                        | Page metadata changes                      |
| `sitemapEffect`       | `pagesMarkdown.pageInfos`                                                        | Page metadata changes                      |

## Build Outputs

| Effect         | Output Location                 | Description                       | Served At          |
| -------------- | ------------------------------- | --------------------------------- | ------------------ |
| API            | `./docs-src/pages/api/`         | TypeDoc-generated markdown        | `/api/`            |
| CSS            | `./docs/assets/main.css`        | Minified CSS bundle               | `/assets/main.css` |
| JavaScript     | `./docs/assets/main.js`         | Minified JS bundle with sourcemap | `/assets/main.js`  |
| Service Worker | `./docs/sw.js`                  | PWA caching service worker        | `/sw.js`           |
| Examples       | `./docs/examples/*.html`        | Syntax-highlighted code examples  | `/examples/`       |
| Pages          | `./docs/**/*.html`              | Complete HTML pages from markdown | `/` (all routes)   |
| Menu           | `./docs-src/includes/menu.html` | Navigation menu component         | N/A (included)     |
| Sitemap        | `./docs/sitemap.xml`            | SEO sitemap                       | `/sitemap.xml`     |

## HMR Debugging

### Client-side Debugging

The HMR client exposes a global `__HMR__` object in development:

```javascript
// Check connection status
window.__HMR__.status()

// Manually reconnect
window.__HMR__.reconnect()

// Disconnect
window.__HMR__.disconnect()
```

### Server-side Logging

Enable verbose logging with `DEBUG=1`:

```bash
DEBUG=1 bun run dev
```

### Common Issues

**WebSocket connection fails**:
- Check if server is running
- Verify `/ws` endpoint is accessible
- Check browser console for errors

**Files not reloading**:
- Verify file is in watched directories
- Check file watcher permissions
- Look for build errors in console

**Build errors during development**:
- Build errors are displayed in the browser during development
- Check server console for detailed error messages
- File watching continues even after build failures

## Extending the System

### Adding New Markdoc Schemas

1. **Create schema file** in `server/schema/`:

```typescript
import type { Schema } from '@markdoc/markdoc'
import { commonAttributes, standardChildren } from '../markdoc-helpers'

const myComponent: Schema = {
    render: 'my-custom-component',
    children: standardChildren,
    attributes: {
        ...commonAttributes,
        title: { type: String, required: true }
    }
}

export default myComponent
```

2. **Add to Markdoc config** in `server/markdoc.config.ts`:

```typescript
import myComponent from './schema/my-component.markdoc'

export const markdocConfig = {
    // ... existing config
    tags: {
        // ... existing tags
        'my-component': myComponent,
    }
}
```

3. **Use in markdown**:

```markdown
{% my-component title="Hello World" %}
Content goes here...
{% /my-component %}
```

### Adding Schema Utilities

Add reusable functions to `markdoc-helpers.ts`:

```typescript
// Common pattern for creating buttons
export function createCustomButton(text: string, className?: string): Tag {
    return new Tag('button', {
        type: 'button',
        class: className || 'default'
    }, [text])
}
```

### Custom Template Functions

Add template utilities in `server/templates/`:

```typescript
import { html } from './utils'

export function customTemplate(data: any): string {
    return html`
        <div class="custom">
            ${data.content}
        </div>
    `
}
```

## Performance Optimizations

### Markdoc Processing

- **Lazy transformation**: Content only processed when pages are requested
- **Cached results**: Processed content cached until dependencies change
- **Syntax highlighting**: Code blocks highlighted asynchronously
- **Schema reuse**: Common utilities prevent code duplication

### Build Efficiency

- **Incremental builds**: Only changed files trigger rebuilds
- **Parallel processing**: Independent effects run simultaneously
- **Smart caching**: Content hashing prevents unnecessary regeneration
- **Memory efficiency**: Large files processed in streams

### HMR Performance

- **File Watching Efficiency**: Uses native `fs.watch()` for performance
- **Debouncing**: Prevents excessive rebuilds from rapid file changes
- **Selective Path Watching**: Reduces overhead by watching only relevant directories
- **Memory Management**: Client connections cleaned up automatically
- **Network Efficiency**: JSON messages with keep-alive pings

### Asset Optimization

- **Minification**: CSS and JS automatically minified
- **Source maps**: Generated for development debugging
- **Compression**: Brotli and Gzip for smaller payloads
- **Cache headers**: Optimal caching for static assets

## Production Considerations

### HMR in Production

- HMR is automatically disabled when `NODE_ENV !== 'development'`
- WebSocket endpoint returns 404 in production
- HMR scripts are not injected in production builds
- File watching is disabled in production

### Production Deployment

For production deployment:

```bash
# Build optimized static site
bun run build:docs

# Deploy ./docs/ directory to any static host
# - GitHub Pages
# - Netlify
# - Vercel
# - AWS S3 + CloudFront
```

The generated `./docs/` directory contains a complete static site with:
- Optimized HTML with embedded Markdoc-processed content
- Minified CSS and JavaScript bundles
- Service worker for offline functionality
- SEO-optimized sitemap and meta tags
- Syntax-highlighted code blocks
- Interactive components with progressive enhancement

## Benefits

### Content Authoring

- **Rich components**: Interactive carousels, tabs, callouts, code demos
- **Syntax highlighting**: Automatic code highlighting with copy buttons
- **Type safety**: Markdoc schemas provide validation and IDE support
- **Reusable patterns**: Common utilities for consistent components

### Developer Experience

- **Hot reloading**: Changes trigger immediate rebuilds and browser refresh
- **Clear logging**: Each effect reports progress and errors
- **Error isolation**: Failed builds don't crash the entire system
- **Extensible**: Easy to add new schemas and content types
- **Live error display**: Build errors shown directly in browser

### Performance

- **Fast builds**: Bun runtime with reactive dependency tracking
- **Efficient updates**: Only affected files are processed
- **Small bundles**: Tree-shaking and minification
- **Progressive enhancement**: Components work without JavaScript
- **Instant feedback**: Sub-second rebuild and reload cycles

## Migration Guide

### From Traditional Build Tools

This reactive Markdoc system with HMR replaces:

- **Webpack/Vite**: Asset bundling and development server
- **MDX/Gatsby**: Markdown processing with components
- **Custom Scripts**: Build orchestration and file watching
- **Plugin Systems**: Complex configuration management

### Content Migration

Convert existing markdown:

```markdown
<!-- Old: Raw HTML -->
<div class="callout tip">
  <h4>Tip</h4>
  <p>This is a tip</p>
</div>

<!-- New: Markdoc schema -->
{% callout class="tip" title="Tip" %}
This is a tip
{% /callout %}
```

### Development Workflow Migration

Old workflow:
```bash
# Manual build + serve
npm run build && npm run serve
# Manual refresh after changes
```

New workflow:
```bash
# One command for development
bun run dev
# Automatic rebuild + reload
```
