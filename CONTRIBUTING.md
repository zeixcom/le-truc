# Contributing to Le Truc

Thank you for your interest in contributing to **Le Truc**! Your contributions help improve the project and benefit the community. This guide outlines how to get involved.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Issues](#reporting-issues)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [License](#license)

---

## Code of Conduct

By participating in this project, you agree to abide by our **[Code of Conduct](CODE_OF_CONDUCT.md)**. Please ensure that all interactions remain respectful and constructive.

---

## How to Contribute

### Reporting Issues

If you find a bug or have a feature request:

1. **Search the issue tracker** to check if your issue has already been reported.
2. If not, [open a new issue](https://github.com/zeixcom/le-truc/issues/new) and provide:
   - A clear and descriptive title.
   - Steps to reproduce the issue (if applicable).
   - Expected vs. actual behavior.
   - Screenshots or logs, if relevant.

### Suggesting Enhancements

We welcome feature suggestions! Before submitting a proposal:

1. **Check existing discussions and issues** to see if your idea has been considered before.
2. Provide a **use case** and explain why the feature is needed.
3. If possible, include a rough implementation idea.

### Submitting Pull Requests

We love code contributions! To submit a pull request (PR):

1. **Fork the repository** and clone it locally.
2. Create a **new branch** (`feature/my-new-feature` or `fix/bug-name`).
3. Make your changes, following our [Coding Guidelines](#coding-guidelines).
4. Ensure all tests pass before committing.
5. Write a **clear commit message** (see [Commit Message Guidelines](#commit-message-guidelines)).
6. Push your branch and **open a pull request** with:
   - A brief description of your changes.
   - Any related issue numbers (`Fixes #123`).
   - Screenshots (if UI changes are made).

---

## Development Setup

To set up the project locally:

**Install dependencies:**

```sh
bun install
```

(Le Truc uses Bun as its package manager and runtime.)

**Run tests in watch mode:**

```sh
bun run test:watch
```

**Build the project:**

```sh
bun run build
```

**Start a development server for docs:**

```sh
bun run serve:docs
```

**Chrome DevTools Workspace Integration:**

For enhanced development experience with live editing in Chrome DevTools:

```sh
# Verify DevTools workspace configuration
bun run verify:devtools

# Then follow the setup instructions:
# 1. Open Chrome and navigate to http://localhost:3000
# 2. Open DevTools (F12)
# 3. Go to Sources tab → Workspace (left sidebar)
# 4. Click "Connect"
# 5. Allow access when Chrome prompts for permissions
```

Once configured, you can edit CSS, JavaScript, and other files directly in DevTools, and changes will be automatically saved to your source files and hot-reloaded.

---

## Coding Guidelines

To maintain a high-quality codebase, please follow these guidelines:

- Follow the project's existing coding style.
- Avoid unnecessary dependencies.
- Use functional programming principles where applicable.
- Prefer composition over inheritance.
- Make sure to lint your code (`bun run lint`) and all tests pass (`bun run test:watch`).

## Commit Message Guidelines

We use **conventional commits** for clear history and automated changelogs.

**Format:**

```txt
type(scope): short description

[optional longer description]
```

**Examples:**

- `feat(ui): add new LazyLoad component`
- `*fix(scheduler): resolve timing issue on initial load`
- `docs: update documentation for Context API`

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code style changes (no logic changes)
- `refactor`: Code restructuring (no new features or bug fixes)
- `test`: Adding or improving tests
- `chore`: Maintenance tasks (e.g., build system updates)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License, unless otherwise stated.

---

Thank you for contributing to Le Truc! 🚀
