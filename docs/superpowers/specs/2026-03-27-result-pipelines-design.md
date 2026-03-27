# Result Pipelines Design

Date: 2026-03-27
Package: `@zireal/result-kit`
Status: Approved for planning

## Summary

Add fluent sync and async pipeline helpers that compose existing `Result`
values while widening the failure union across chained steps.

The feature is intentionally type-level. Runtime behavior stays unchanged: a
failed `Result` still carries one concrete error payload, and pipeline
composition still short-circuits on the first failure.

## Problem

The current API supports explicit result composition through static helpers such
as `ResultKit.andThen(...)`, but deep service flows become awkward when callers
want to chain multiple result-producing functions and have the full error union
inferred automatically.

Today, users can model this manually, but the composition style is nested and
does not provide a fluent way to accumulate possible error types across
multiple service boundaries.

## Goals

- Provide a fluent composition API for result-producing workflows.
- Support starting from either a raw value or an existing `Result`.
- Provide a separate async pipeline to keep sync and async flows distinct.
- Automatically widen error unions across chained `.andThen(...)` calls.
- Preserve current runtime semantics and current `Result<T, E>` shape.
- Keep the first version small and easy to reason about.

## Non-Goals

- Do not add runtime error stack accumulation or contextual wrappers.
- Do not change the shape of `Result<T, E>`, `Failure<E>`, or `TypedError`.
- Do not merge sync and async pipelines into a single abstraction.
- Do not add recovery-oriented pipeline methods in v1.
- Do not add fluent mirrors for every existing `ResultKit` helper in v1.

## Proposed API

Add two pipeline wrappers in `src/core` and expose them through `ResultKit`:

- `ResultPipeline<T, E>`
- `AsyncResultPipeline<T, E>`

Add factory methods:

- `ResultKit.pipe(valueOrResult)`
- `ResultKit.pipeAsync(valueOrResultOrPromise)`

Add minimal fluent methods in v1:

- `.andThen(...)`
- `.done()`

## Sync Pipeline

### Construction

`ResultKit.pipe(...)` accepts:

- a raw value `T`, which becomes `ResultKit.success(value)`
- an existing `Result<T, E>`, which is preserved as-is

### Composition

`ResultPipeline<T, E>#andThen(...)` accepts a result-producing step:

```ts
(value: T) => Result<U, F>
```

and returns:

```ts
ResultPipeline<U, E | F>
```

If the current pipeline is already failed, the step is skipped and the existing
failure is preserved.

### Completion

`ResultPipeline<T, E>#done()` returns:

```ts
Result<T, E>
```

### Example

```ts
const result = ResultKit
  .pipe(token)
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId))
  .andThen((user) => loadInvoice(user.id))
  .done();
```

Inferred output:

```ts
Result<Invoice, AuthError | UserError | BillingError>
```

## Async Pipeline

### Construction

`ResultKit.pipeAsync(...)` accepts:

- a raw value `T`
- a `Promise<T>`
- an existing `Result<T, E>`
- a `Promise<Result<T, E>>`

This keeps async entry flexible without overloading the sync pipeline.

### Composition

`AsyncResultPipeline<T, E>#andThen(...)` accepts an async result-producing step:

```ts
(value: T) => Promise<Result<U, F>>
```

and returns:

```ts
AsyncResultPipeline<U, E | F>
```

After the current state resolves, the pipeline short-circuits on failure and
does not invoke later steps.

### Completion

`AsyncResultPipeline<T, E>#done()` returns:

```ts
Promise<Result<T, E>>
```

### Example

```ts
const result = await ResultKit
  .pipeAsync(token)
  .andThen(requireSessionAsync)
  .andThen((session) => findUserAsync(session.userId))
  .andThen((user) => loadInvoiceAsync(user.id))
  .done();
```

Inferred output:

```ts
Result<Invoice, AuthError | UserError | BillingError>
```

## Typing Rules

The feature's main value is in the inferred error union.

For sync composition:

```ts
ResultPipeline<T, E>
  .andThen((value: T) => Result<U, F>)
  -> ResultPipeline<U, E | F>
```

For async composition:

```ts
AsyncResultPipeline<T, E>
  .andThen((value: T) => Promise<Result<U, F>>)
  -> AsyncResultPipeline<U, E | F>
```

This union widening is compile-time only. At runtime, a failure still contains
exactly one concrete error payload from the step that failed.

## Runtime Semantics

- Pipelines are composition helpers, not a new result representation.
- A successful pipeline passes its value into the next step.
- A failed pipeline skips later `.andThen(...)` steps.
- The failure payload is preserved exactly as returned by the failing step.
- Existing `ResultKit` helpers remain valid and unchanged.

## Internal Structure

The implementation should stay lightweight:

- `ResultPipeline` should store a `Result<T, E>`.
- `AsyncResultPipeline` should store a `Promise<Result<T, E>>`.
- `ResultKit.pipe(...)` and `ResultKit.pipeAsync(...)` should normalize input
  into those internal representations.
- Fluent methods should delegate to the existing result semantics rather than
  re-implementing custom branching rules.

The wrappers should live in `src/core` and be exported through the core entry
point so consumers can reference the types if needed.

## V1 Scope

Include:

- `ResultKit.pipe(...)`
- `ResultKit.pipeAsync(...)`
- `ResultPipeline#andThen(...)`
- `AsyncResultPipeline#andThen(...)`
- `ResultPipeline#done()`
- `AsyncResultPipeline#done()`

Defer:

- fluent `map`, `mapError`, `tap`, `match`
- `orElse`-style recovery in pipelines
- sync pipelines that accept async steps
- runtime context stacking or boundary wrappers
- specialized DSLs beyond `pipe` and `pipeAsync`

## Testing Strategy

Add tests under `test/core` for:

- starting a sync pipeline from a raw value
- starting a sync pipeline from an existing `Result`
- starting an async pipeline from a raw value
- starting an async pipeline from a `Promise<T>`
- starting an async pipeline from a `Result`
- starting an async pipeline from a `Promise<Result<T, E>>`
- widening unions across multiple `.andThen(...)` calls
- short-circuiting after the first failure
- preserving the exact runtime error payload from the failing step
- ensuring later async steps are not invoked after failure

## Documentation Impact

Update:

- `README.md` API surface
- `README.md` core usage section with pipeline examples
- `examples/core.ts` with a fluent composition example

If the pipeline wrapper types are exported publicly, the core entrypoint and
package exports should be updated consistently.

## Compatibility

This is a backward-compatible feature addition.

- Existing static `ResultKit` helpers remain available.
- Existing consumers do not need to migrate.
- The new fluent API provides an additional composition style.

## Open Implementation Notes

- Prefer a small number of overloads on `pipe(...)` and `pipeAsync(...)` over
  broad generic signatures that reduce readability.
- Keep async method signatures strict in v1 to avoid ambiguous sync/async step
  inference.
- Reuse `ResultKit.isSuccess(...)` and `ResultKit.isFailure(...)` internally
  where practical so branching rules stay consistent.
