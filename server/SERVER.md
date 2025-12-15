# Development Server

The unified server system provides a flexible, layout-driven development server that can handle both documentation and component testing with automatic layout selection based on routes.

## Features

- **Flexible Layout System**: Automatic layout selection based on URL patterns
- **Multiple Server Modes**: Documentation, examples, or unified (both)
- **Hot Module Reloading**: Live updates during development
- **Template Variables**: Full template variable substitution
- **Include Support**: Template includes for shared content
- **Compression**: Automatic response compression
- **Asset Handling**: Smart asset serving with caching

## Quick Start

```bash
# Start unified server (documentation + examples)
bun run serve

# Documentation only
bun run serve:docs

# Examples only
bun run serve:examples

# Custom configuration
bun server/serve-unified.ts --mode unified --port 8000
```

## Layout System

### Automatic Layout Selection

The server automatically selects layouts based on URL patterns:

| URL Pattern | Layout | Description |
|-------------|--------|-------------|
| `/test/{component}.html` | `test` | Component testing pages |
| `/api/classes/{id}.html` | `api` | API documentation (classes) |
| `/api/functions/{id}.html` | `api` | API documentation (functions) |
| `/api/type-aliases/{id}.html` | `api` | API documentation (types) |
| `/api/variables/{id}.html` | `api` | API documentation (variables) |
| `/examples/{example}.html` | `example` | Example showcase pages |
| `/blog/{article}.html` | `blog` | Blog articles |
| `/api/`, `/examples/`, `/blog/` | `overview` | Index/listing pages |
| All other pages | `page` | Default documentation layout |

### Available Layouts

#### 1. **page** - Default Documentation Layout
- Full navigation and header
- Template variable support
- Include processing
- Used for: Regular documentation pages

#### 2. **test** - Component Testing Layout
- Minimal chrome for testing
- Error display component
- Asset loading for components
- Used for: `/test/{component}.html` routes

#### 3. **api** - API Documentation Layout
- Breadcrumb navigation
- Sidebar table of contents
- API-specific styling and metadata
- Used for: API reference pages

#### 4. **example** - Example Showcase Layout
- Hero header with example metadata
- Live demo and source code links
- Navigation between examples
- Used for: Example documentation pages

#### 5. **blog** - Blog Article Layout
- Article-focused design
- Author information
- Reading time and metadata
- Navigation between posts
- Used for: Blog articles

#### 6. **overview** - Listing/Index Layout
- Grid-based content display
- Search and filter functionality
- Pagination support
- Statistics display
- Used for: Index pages and overviews

## Template Variables

All layouts support template variable substitution using `{{ variable-name }}` syntax:

### Common Variables
- `{{ content }}` - Main content area
- `{{ title }}` - Page title
- `{{ description }}` - Page description
- `{{ section }}` - Current section (docs, api, examples, etc.)
- `{{ base-path }}` - Base URL path
- `{{ css-hash }}` - CSS asset hash for cache busting
- `{{ js-hash }}` - JS asset hash for cache busting

### Layout-Specific Variables

#### Test Layout
- `{{ component-name }}` - Name of the component being tested

#### API Layout
- `{{ api-category }}` - API category (classes, functions, etc.)
- `{{ api-name }}` - API item name
- `{{ api-kind }}` - API item kind
- `{{ toc }}` - Table of contents

#### Example Layout
- `{{ example-name }}` - Example name
- `{{ example-description }}` - Example description
- `{{ example-difficulty }}` - Difficulty level
- `{{ example-slug }}` - URL-safe example identifier
- `{{ example-tags }}` - Example tags
- `{{ example-source }}` - Source code URL

#### Blog Layout
- `{{ author }}` - Article author
- `{{ published-date }}` - Publication date
- `{{ reading-time }}` - Estimated reading time
- `{{ blog-tags }}` - Article tags
- `{{ prev-post }}` - Previous post URL
- `{{ next-post }}` - Next post URL

#### Overview Layout
- `{{ overview-title }}` - Overview page title
- `{{ overview-description }}` - Overview description
- `{{ overview-stats }}` - Statistics display
- `{{ search-placeholder }}` - Search input placeholder
- `{{ filter-options }}` - Filter dropdown options

## Server Modes

### `docs` Mode
- Serves built documentation from `./docs`
- Enables HMR and compression
- Builds documentation on startup
- Default port: 3000

### `examples` Mode
- Serves component test pages from `./examples`
- Handles `/test/{component}.html` routes
- Serves example assets from `/assets/`
- Default port: 4173

### `unified` Mode (Default)
- Combines both docs and examples functionality
- Supports all route types and layouts
- Full feature set enabled
- Default port: 5000

## Configuration

### Environment Variables
- `PORT` - Server port (overrides defaults)
- `HOST` - Server hostname (default: localhost)

### Command Line Options
```bash
bun server/serve.ts [options]

Options:
  --mode <mode>           Server mode: docs, examples, unified
  --port <port>           Port number
  --host <host>           Host address
  --no-hmr                Disable Hot Module Reloading
  --no-compression        Disable response compression
  --build-first           Build documentation before starting
  --help                  Show help message
```

### Programmatic Usage

```typescript
import { UnifiedDevServer } from './server/serve'

const server = new UnifiedDevServer({
  mode: 'unified',
  port: 8000,
  enableHMR: true,
  buildFirst: true,
})

await server.start()
```

## Adding New Layouts

1. Create the layout file in `server/layouts/`:
```html
<!doctype html>
<html lang="en">
  <head>
    <title>{{ title }}</title>
    <!-- ... -->
  </head>
  <body>
    {{ content }}
  </body>
</html>
```

2. Add the layout path to `server/config.ts`:
```typescript
export const LAYOUT_PATHS = {
  // existing layouts...
  'my-layout': `${LAYOUTS_DIR}/my-layout.html`,
} as const
```

3. Add route mapping:
```typescript
export const ROUTE_LAYOUT_MAP = {
  // existing routes...
  '/my-section/': 'my-layout',
} as const
```

4. Add to default layouts in `server/layout-engine.ts`:
```typescript
export const DEFAULT_LAYOUTS: LayoutConfig[] = [
  // existing layouts...
  {
    name: 'my-layout',
    path: LAYOUT_PATHS['my-layout'],
    type: 'template',
    contentMarker: CONTENT_MARKER,
    defaultContext: {
      section: 'my-section',
    }
  }
]
```

## Architecture

The unified server is built on top of the existing build system and integrates with:

- **Build System**: Uses existing `server/build.ts` for documentation building
- **Template Engine**: Leverages `server/templates/` utilities
- **File Watching**: Inherits from existing file watching system
- **Layout Engine**: New flexible layout processing system
- **Asset Handling**: Smart asset resolution across multiple directories

## Migration from Old Servers

### From `server/serve.ts` (Documentation)
- Replace `bun server/serve.ts` with `bun run serve:docs`
- All existing functionality preserved
- Additional layout flexibility added

### From `examples/server.ts` (Component Testing)
- Replace `bun examples/server.ts` with `bun run serve:examples`
- Test pages now use proper layout system
- Enhanced styling and error handling

### Combined Usage
- Use `bun run serve` for unified development
- Single server handles both use cases
- Consistent development experience

## Troubleshooting

### Layout Not Found
- Check that layout file exists in `server/layouts/`
- Verify layout is added to `LAYOUT_PATHS` in config
- Ensure route mapping exists in `ROUTE_LAYOUT_MAP`

### Template Variables Not Working
- Verify variable names match exactly (case-sensitive)
- Check that layout type is set to `'template'` not `'simple'`
- Ensure context is being passed correctly

### Assets Not Loading
- Check asset paths in layout files
- Verify assets exist in expected directories (`docs/assets/`, `examples/assets/`)
- Check browser network tab for 404 errors

### HMR Not Working
- Ensure WebSocket connection is established
- Check browser console for connection errors
- Verify `enableHMR` option is true
