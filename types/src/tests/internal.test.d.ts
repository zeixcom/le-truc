/**
 * Unit tests for the ambient effect-descriptor collector in src/internal.ts.
 *
 * See ADR 0018: watch()/on()/pass()/each()/provideContexts() push descriptors
 * into whatever collector `withCollector()` currently has active and return
 * `void` — the collector is the only registration path. This file tests the
 * collection primitive itself, not any of the helpers wired to use it.
 */
export {};
