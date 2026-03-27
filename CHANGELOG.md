# @zireal/result-kit

## 3.0.1

### Patch Changes

- 8688188: Improve the generated API documentation shipped with the package.

  This adds richer JSDoc across the public API and key helper symbols, including
  parameter, return, and usage examples so client IDEs can show more useful
  inline documentation and autocomplete help from the published declaration
  files.

## 3.0.0

### Major Changes

- 57ccb29: Redesign `Result` as a discriminated union and improve the package's type-system ergonomics.

  This breaking change replaces the abstract `Result` class type with the public
  union `Ok<T> | Err<E>`, which means consumers can now narrow directly on
  `result.ok` without losing fluent instance methods on concrete results.

  `TypedError` now supports typed `details`, `fail(...)` preserves richer error
  subtypes, and the core helpers expose stronger inference for predicate
  narrowing, typed-error guards, tuple combination, and async result chaining.

  Consumers should update any code that relied on `Result` as a class identity or
  `instanceof` target and prefer control-flow checks like `if (result.ok)` or
  `isTypedError(error, "validation_error")` for narrowing.

## 2.0.0

### Major Changes

- 8fbc07e: Replace the v1 static-helper and pipeline model with a fluent class-based result API.

  Breaking changes:

  - Removed `ResultPipeline` and `AsyncResultPipeline`
  - Removed `pipe(...)` and `pipeAsync(...)`
  - Removed the old static-first helpers such as `ResultKit.map(...)`, `andThen(...)`, `orElse(...)`, and `match(...)`
  - Result values are now class-backed `Ok` and `Err` instances

  New primary API:

  - `ok(...)` for success values
  - `fail(...)` for `TypedError`-first failures
  - `err(...)` for generic non-typed failures
  - `ResultAsync` for fluent async composition
  - instance methods such as `.andThen(...)`, `.map(...)`, `.orElse(...)`, and `.match(...)`

  Why:

  The old API required a separate static namespace and pipeline wrapper to compose results. v2 moves composition onto the result value itself, keeps `TypedError` as the package-default error model, and makes async flows first-class with `ResultAsync`.

  How to migrate:

  - Replace `ResultKit.success(value)` with `ok(value)`
  - Replace `ResultKit.fail(error)` with `fail(error)`
  - Replace `ResultKit.failure(error)` with `err(error)`
  - Replace `ResultKit.pipe(value).andThen(step)` with `ok(value).andThen(step)`
  - Replace `ResultKit.pipe(existingResult).andThen(step)` with `existingResult.andThen(step)`
  - Replace `ResultKit.pipeAsync(...)` pipelines with `ResultAsync.fromPromise(...)` or direct `ResultAsync` chaining

### Minor Changes

- 8fbc07e: Add back `ResultKit` as a branded static facade over the new fluent v2 API.

  What was added:

  - `ResultKit.ok(...)`
  - `ResultKit.fail(...)`
  - `ResultKit.err(...)`
  - `ResultKit.okAsync(...)`
  - `ResultKit.errAsync(...)`
  - boundary helpers such as `ResultKit.fromThrowable(...)`, `ResultKit.fromNullable(...)`, `ResultKit.combine(...)`, and async counterparts

  Why:

  The fluent v2 model already supports direct composition on `Ok`, `Err`, and `ResultAsync`, but some consumers still want a package-branded entrypoint in user code and examples. This facade preserves the `result-kit` identity without reintroducing pipeline wrappers or moving behavior back out of the fluent result types.

  Notes:

  - `ResultKit` is a thin facade only; the actual runtime behavior still lives on `Ok`, `Err`, `Result`, and `ResultAsync`
  - `ResultKit.pipe(...)` and `ResultKit.pipeAsync(...)` are still removed
  - fluent chaining continues to happen on the returned result instances

## 1.1.0

### Minor Changes

- cf83708: Add fluent sync and async result pipelines for composing result-producing workflows with automatic error union widening.

## 1.0.2

### Patch Changes

- 6aa0638: Fix npm publishing so the built `dist` files are generated before release and included in the published package tarball.

## 1.0.1

### Patch Changes

- Improve JSDoc coverage across the core and Nest APIs so generated type declarations provide clearer IntelliSense for package consumers.
