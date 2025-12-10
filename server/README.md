# Reactive Build System

A radically simplified dev server built with [Cause & Effect](https://github.com/zeix/cause-effect) for reactive dependency tracking and Bun 1.3+ capabilities for fast builds and HMR.

## Overview

This build system uses reactive programming principles to create an elegant, efficient static site generator with automatic dependency tracking. Unlike traditional build tools with complex pipelines, this system uses **reactive signals** and **effects** to declaratively define what should happen when files change.

## Architecture

### Core Components

#### 📁 File Watcher (`file-watcher.ts`)

- **`watchFiles(directory, options)`**: Creates reactive state that automatically updates when filesystem changes occur
- Supports recursive watching, file extension filtering, and ignore patterns
- Returns `State<Map<string, FileInfo>>` that other parts of the system can reactively depend on

#### 🔄 File Signals (`file-signals.ts`)

Defines reactive signals for different file types:

- **`markdownFiles`**: Tracks markdown files with frontmatter processing
  - `sources`: Raw markdown files from `./docs-src/pages/`
  - `processed`: Computed signal with extracted frontmatter and metadata
  - `pageInfos`: Computed signal generating page navigation data
  - `fullyProcessed`: Computed signal with complete markdown→HTML transformation

- **`libraryScripts`**: TypeScript files from `./src/` (Le Truc library source)
- **`docsScripts`**: TypeScript files from `./docs-src/` (documentation scripts)
- **`componentScripts`**: Component TypeScript from `./docs-src/components/`
- **`templateScripts`**: Template functions from `./docs-src/templates/`
- **`docsStyles`**: CSS files from `./docs-src/`
- **`componentStyles`**: Component CSS from `./docs-src/components/`
- **`componentMarkup`**: HTML template files from `./docs-src/components/`

#### ⚡ Effects (`effects/`)

Each effect reactively responds to file changes and performs specific build tasks:

1. **`apiEffect`** - Generates API documentation using TypeDoc when library source changes
2. **`cssEffect`** - Rebuilds and minifies CSS when stylesheets change
3. **`jsEffect`** - Bundles and minifies JavaScript when scripts change
4. **`serviceWorkerEffect`** - Generates service worker after assets are built
5. **`examplesEffect`** - Creates syntax-highlighted code examples from component files
6. **`menuEffect`** - Generates navigation menu from page metadata
7. **`pagesEffect`** - Processes markdown files to HTML with full template support
8. **`sitemapEffect`** - Creates XML sitemap for SEO

### Reactive Flow

```
File Changes → File Signals → Computed Values → Effects → Output Files
```

1. **File Watcher** detects changes and updates reactive state
2. **Computed Signals** automatically recalculate derived data
3. **Effects** trigger when their dependencies change
4. **Build Outputs** are generated only when necessary

## Dependencies Tracked

### Direct File Dependencies

| Signal             | Watches                  | Extensions | Recursive | Purpose                   |
| ------------------ | ------------------------ | ---------- | --------- | ------------------------- |
| `markdownFiles`    | `./docs-src/pages/`      | `.md`      | ✅        | Site content and API docs |
| `libraryScripts`   | `./src/`                 | `.ts`      | ✅        | Library source code       |
| `docsScripts`      | `./docs-src/`            | `.ts`      | 🛑        | Documentation scripts     |
| `componentScripts` | `./docs-src/components/` | `.ts`      | ✅        | Component logic           |
| `templateScripts`  | `./docs-src/templates/`  | `.ts`      | ✅        | Template functions        |
| `docsStyles`       | `./docs-src/`            | `.css`     | 🛑        | Main stylesheets          |
| `componentStyles`  | `./docs-src/components/` | `.css`     | ✅        | Component styles          |
| `componentMarkup`  | `./docs-src/components/` | `.html`    | ✅        | Component templates       |

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
# Development build with file watching (build only)
bun run docs-src/server/build.ts

# Development server with HMR (recommended)
bun run docs-src/server/serve.ts

# The server will:
# 1. Initialize the reactive build system
# 2. Start HTTP server on http://localhost:3000
# 3. Watch for changes and rebuild incrementally
# 4. Notify browser clients to reload via WebSocket
# 5. Keep running until Ctrl+C
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
PORT=8080 HOST=0.0.0.0 bun run docs-src/server/serve.ts

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

### Build Sequence

1. **API Documentation** - Generate TypeDoc markdown from library source
2. **Asset Building** - CSS and JavaScript minification (parallel)
3. **Service Worker** - Generate with asset hashes (after CSS/JS)
4. **Examples** - Create syntax-highlighted code samples
5. **Navigation** - Generate menu from processed pages
6. **Pages** - Process all markdown to HTML (uses generated API docs)
7. **SEO** - Create sitemap from processed pages

## Extending the System

### Adding New File Types

1. **Create a new signal** in `file-signals.ts`:

```typescript
export const newFileType = (() => {
  const sources = watchFiles('./path/to/files', {
    recursive: true,
    extensions: ['.ext'],
  })

  return { sources }
})()
```

2. **Create an effect** in `effects/new-effect.ts`:

```typescript
import { effect } from '@zeix/cause-effect'
import { newFileType } from '../file-signals'

export const newEffect = () =>
  effect({
    signals: [newFileType.sources],
    ok: (sources: Map<string, any>): undefined => {
      // Process files when they change
      console.log(`Processing ${sources.size} files...`)
      return undefined
    },
    err: (error: Error): undefined => {
      console.error('Error in new effect:', error.message)
      return undefined
    },
  })
```

3. **Add to build orchestration** in `build.ts`:

```typescript
import { newEffect } from './effects/new-effect'

// In the build function:
const newEffectCleanup = newEffect()

// In cleanup:
newEffectCleanup?.()
```

### Adding Computed Preprocessing

For complex transformations, add computed signals to `file-signals.ts`:

```typescript
const processed = computed(async () => {
  const rawFiles = sources.get()
  if (rawFiles === UNSET) return UNSET

  const processedFiles = new Map()
  for (const [path, fileInfo] of rawFiles) {
    // Transform file content
    const transformed = await processFile(fileInfo.content)
    processedFiles.set(path, { ...fileInfo, transformed })
  }
  return processedFiles
})
```

### Custom Build Logic

Effects can perform any build operations:

```typescript
effect({
  signals: [dependency1, dependency2],
  ok: async (dep1, dep2): Promise<void> => {
    // Custom build logic
    await runCustomTool()
    await generateCustomOutput()
    console.log('Custom build completed')
  },
})
```

## Benefits

### Reactive Architecture

- **Declarative**: Describe what should happen, not how/when
- **Efficient**: Only rebuilds what's needed when dependencies change
- **Automatic**: No manual dependency tracking or build orchestration

### Performance

- **Lazy Evaluation**: Computed signals only run when accessed by effects
- **Incremental Builds**: Only affected files are processed
- **Parallel Execution**: Independent effects can run simultaneously
- **Fast Runtime**: Bun provides excellent performance for file operations

### Maintainability

- **Small Codebase**: ~2000 lines vs 10,000+ in traditional bundlers
- **Clear Separation**: Each effect handles one concern
- **Type Safety**: Full TypeScript support with strict checking
- **Debuggable**: Simple reactive flow is easy to trace

### Developer Experience

- **Hot Reloading**: Changes trigger immediate rebuilds
- **Clear Logging**: Each effect reports its progress
- **Error Isolation**: Failed effects don't crash the entire system
- **Extensible**: Easy to add new file types and build steps

## Technical Details

### Async Computed Values

Async computed signals use the `UNSET` symbol pattern:

```typescript
const computed = computed(async () => {
  const dependency = sources.get()
  if (dependency === UNSET) return UNSET

  // Process asynchronously
  return await processData(dependency)
})
```

### Effect Async Handling

Effects must be synchronous, but can handle async operations:

```typescript
effect({
  signals: [dependency],
  ok: (data): undefined => {
    ;(async () => {
      await doAsyncWork(data)
    })()
    return undefined
  },
})
```

### File Watcher Implementation

The file watcher uses Node.js `fs.watch` with proper path handling for cross-platform compatibility and `readdir` with `recursive: true` for initial scanning.

## Migration from Traditional Build Tools

This reactive system replaces:

- **Webpack/Vite**: Asset bundling and development server
- **Gulp/Grunt**: Task running and file processing
- **Custom Scripts**: Build orchestration and file watching
- **Plugin Systems**: Complex configuration and dependency management

The reactive approach provides all the same functionality with significantly less complexity and better performance characteristics.

## Development Workflow

### Typical Development Session

1. **Start the server**: `bun run docs-src/server/serve.ts`
2. **Open browser**: Navigate to `http://localhost:3000`
3. **Edit files**: Make changes to any source files
4. **Automatic rebuild**: Watch the console for build notifications
5. **Browser refresh**: HMR automatically refreshes the page

### File Change Examples

```bash
# Edit a markdown file
echo "# Updated content" >> docs-src/pages/index.md
# → Pages effect rebuilds → Menu/sitemap update → Browser refreshes

# Edit library source
echo "export const newFunction = () => {}" >> src/index.ts
# → API effect regenerates docs → Pages rebuild → Browser refreshes

# Edit styles
echo ".new-style { color: red; }" >> docs-src/main.css
# → CSS effect rebuilds → Service worker updates → Browser refreshes
```

### Debugging

- **Console output**: Each effect reports its progress and errors
- **Browser DevTools**: Check console for HMR connection status
- **Network tab**: Verify asset caching and compression
- **WebSocket**: Monitor `/ws` connection for HMR communication

### Production Build

For production deployment, run the build once without the server:

```bash
bun run docs-src/server/build.ts
# Generates optimized static files in ./docs/
# Deploy ./docs/ directory to any static host
```
