# Documentation Improvement Plan

## Future Blog Posts

Patterns and explanations that were removed from or considered too in-depth for the core docs. Each is a good candidate for a standalone post.

### "Le Truc vs the Alternatives — Why We Do Less"
The positioning content from the introduction carousel ("Faster. Because We Do Less.") goes beyond a quick intro. A blog post comparing Le Truc to SPA frameworks (React, Vue, Svelte, Lit) and Hypermedia frameworks (HTMX, Datastar) could cover the full decision matrix: when each is the right tool and why no-render + no-network is a distinct category.

### "Advanced Event Handling with createEventsSensor()"
The `FormSpinbutton` example in data-flow.md shows a multi-event sensor (click, change, keydown) with clamping, reset, and keyboard navigation. This is a real-world implementation that goes beyond what the docs need for introduction. A post walking through the design of a complex sensor — including the `prev` value pattern and keyboard accessibility — would be a good reference for advanced users.

### "Building a Production Component from Scratch"
A full walkthrough of designing, building, testing, and integrating a non-trivial component (e.g., `form-spinbutton` or `module-list`) with attention to accessibility, progressive enhancement, and component API design. Too detailed for the getting-started docs but valuable as a tutorial.
