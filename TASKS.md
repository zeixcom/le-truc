# Tasks Before Next Release

## Open

- Replace arity-based initializer detection with branded function types in `Initializers<P, U>[K]`.
  - Add branded reader/parser (and method producer if needed) types/helpers.
  - Update component initializer resolution to use brand checks instead of `fn.length`.
  - Migrate internal usage/examples and remove redundant inline UI annotations caused by weak contextual typing.
