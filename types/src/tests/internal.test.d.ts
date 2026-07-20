/**
 * Unit tests for the ambient effect-descriptor collector in src/internal.ts.
 *
 * See ADR 0018: watch()/on()/pass()/each()/provideContexts() push descriptors
 * into whatever collector `withCollector()` currently has active, instead of
 * (or in addition to, for backward compatibility) returning them for the
 * factory to collect. This file tests the collection primitive itself, not
 * any of the helpers that will be wired to use it.
 */
export {};
