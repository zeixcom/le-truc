# Reactive Build System with Markdoc

A modern static site generator built with [Cause & Effect](https://github.com/zeix/cause-effect) reactive signals, [Markdoc](https://markdoc.dev/) content processing, and Bun for fast builds and HMR.

## Overview

This build system uses reactive programming principles to create an efficient documentation site generator with automatic dependency tracking. The system processes Markdown content through Markdoc schemas and generates a complete static site with syntax highlighting, interactive components, and progressive enhancement.

## Architecture

### Core Components

#### 📁 File Watcher (`file-watcher.ts`)

- **`watchFiles(directory, options)`**: Creates reactive state that automatically updates when filesystem changes occur
- Supports recursive watching, file extension filtering, and ignore patterns
- Returns `Store<Record<string, FileInfo>>` that other parts of the system can reactively depend on

#### 🔄 File Signals (`file-signals.ts`)

Defines reactive signals for different file types:

- **`markdownFiles`**: Tracks markdown files with Markdoc processing
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

### Reactive Flow

```
File Changes → File Signals → Markdoc Processing → Effects → Output Files
```

1. **File Watcher** detects changes and updates reactive state
2. **Computed Signals** automatically recalculate derived data
3. **Markdoc Processing** transforms markdown with custom schemas
4. **Effects** trigger when their dependencies change
5. **Build Outputs** are generated only when necessary

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
| `markdownFiles`    | `./docs-src/pages/`      | `.md`      | ✅        | Site content and API docs |
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
| `pagesEffect`         | `markdownFiles.fullyProcessed`                                                   | Markdown files or their processing changes |
| `menuEffect`          | `markdownFiles.pageInfos`                                                        | Page metadata changes                      |
| `sitemapEffect`       | `markdownFiles.pageInfos`                                                        | Page metadata changes                      |

## Usage

### Running the Build System

```bash
# Development build with file watching
bun run build:docs

# Development server with HMR (recommended)
bun run serve:docs

# Production build (one-time)
bun run build:docs
```

### Development Server Features

- **Hot Module Reloading**: Automatic browser refresh when files change
- **Compression**: Brotli and Gzip compression for better performance
- **Caching**: Smart cache headers for versioned and static assets
- **WebSocket**: Real-time communication for HMR
- **Static Serving**: Serves all generated HTML, CSS, JS, and assets

### Server Configuration

```bash
# Custom port and host
PORT=8080 HOST=0.0.0.0 bun run serve:docs

# Default: http://localhost:3000
```

### Build Outputs

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

### Asset Optimization

- **Minification**: CSS and JS automatically minified
- **Source maps**: Generated for development debugging
- **Compression**: Brotli and Gzip for smaller payloads
- **Cache headers**: Optimal caching for static assets

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

### Performance

- **Fast builds**: Bun runtime with reactive dependency tracking
- **Efficient updates**: Only affected files are processed
- **Small bundles**: Tree-shaking and minification
- **Progressive enhancement**: Components work without JavaScript

## Migration Guide

### From Traditional Build Tools

This reactive Markdoc system replaces:

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

## Development Workflow

### Typical Development Session

1. **Start the server**: `bun run serve:docs`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Edit content**: Make changes to markdown files with Markdoc syntax
4. **Automatic rebuild**: Watch console for Markdoc processing and build notifications
5. **Browser refresh**: HMR automatically refreshes the page

### Content Development

```bash
# Create new page
echo '---
title: New Page
---
# New Page
{% callout class="info" %}
This is automatically processed by Markdoc!
{% /callout %}' > docs-src/pages/new-page.md

# Edit carousel
# → Markdoc processes schemas → Pages effect rebuilds → Browser refreshes

# Add new component schema
# → Markdoc config updates → All content reprocesses → Browser refreshes
```

### Debugging Markdoc

- **Validation errors**: Clear schema validation messages in console
- **Transform issues**: Step-by-step transformation logging
- **Content rendering**: Inspect generated HTML structure
- **Schema development**: Hot reloading for schema changes

## Production Deployment

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