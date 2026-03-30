# Documentation Improvement Plan

## Future Blog Posts

Patterns and explanations that were removed from or considered too in-depth for the core docs. Each is a good candidate for a standalone post.

### "Advanced Event Handling with createEventsSensor()"
The `FormSpinbutton` example in data-flow.md shows a multi-event sensor (click, change, keydown) with clamping, reset, and keyboard navigation. This is a real-world implementation that goes beyond what the docs need for introduction. A post walking through the design of a complex sensor — including the `prev` value pattern and keyboard accessibility — would be a good reference for advanced users.
