# Result Type System Redesign

Date: 2026-03-28
Package: `@zireal/result-kit`
Status: Approved for planning

## Summary

Redesign the public `Result<T, E>` model as a true discriminated union while
preserving the package's fluent runtime API through concrete `Ok<T>` and
`Err<E>` classes.

At the same time, upgrade `TypedError` to support typed `details`, preserve
rich error subtypes through `fail(...)`, and add targeted type-level helpers
and narrowing overloads for advanced TypeScript consumers.

This is a type-system-first redesign. The primary value is better narrowing,
better inference, and cleaner generic ergonomics without abandoning the
existing fluent chaining model.

## Problem

The current package exposes `Result<T, E>` as an abstract class hierarchy.
That works at runtime, but it limits how well TypeScript can narrow common
consumer code.

Current gaps:

- `if (result.ok)` does not narrow a plain `Result<T, E>` into success and
  failure branches.
- `Result.fromPredicate(...)` does not preserve type-guard narrowing.
- `isTypedError(...)` narrows only to `TypedError<string>`, not to a concrete
  discriminator.
- `fail(...)` erases richer `TypedError` subtypes instead of preserving them.
- Generic consumers cannot reuse internal extractor types such as the inferred
  success or error member of a result.

These limitations make the package less effective as a foundation for
reusable abstractions, controllers, service boundaries, and higher-order
helpers.

## Goals

- Make `Result<T, E>` narrow correctly with standard TypeScript control flow.
- Preserve the existing fluent chaining style on `ok(...)` and `err(...)`
  instances.
- Keep `Result.fromNullable(...)`, `Result.combine(...)`, and similar
  static-style utilities available.
- Upgrade `TypedError` to support typed `details`.
- Preserve exact error subtypes through `fail(...)`.
- Improve `fromPredicate(...)` and `isTypedError(...)` so they participate in
  type narrowing directly.
- Export a focused set of reusable type helpers for advanced generic use cases.

## Non-Goals

- Do not introduce a heavier error-family mapping DSL in this redesign.
- Do not change the runtime meaning of success, failure, or short-circuiting.
- Do not redesign `ResultAsync` into a structural union; it can remain a class.
- Do not add broad new helper APIs unless they are necessary to unlock the
  approved narrowing and inference improvements.

## Proposed API

### Public Result Surface

The public type changes from an abstract base class to a discriminated union:

```ts
export type Result<T, E> = Ok<T> | Err<E>;
```

`Ok<T>` and `Err<E>` remain public concrete classes so fluent instance methods
continue to work:

```ts
ok("token")
  .andThen(requireSession)
  .andThen(findUser);
```

The exported `Result` value becomes a helper namespace object that preserves
the current static-style calls:

```ts
Result.fromThrowable(...)
Result.fromNullable(...)
Result.fromPredicate(...)
Result.combine(...)
Result.combineWithAllErrors(...)
```

This gives consumers direct control-flow narrowing with:

```ts
if (result.ok) {
  result.value;
} else {
  result.error;
}
```

### Typed Error Surface

Upgrade `TypedError` to carry typed `details` while keeping `type` and
`message` as the stable base contract:

```ts
interface TypedError<
  TType extends string = string,
  TDetails extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
> {
  type: TType;
  message: string;
  details?: TDetails;
  cause?: unknown;
}
```

`TypedErrorOf<TType>` remains an alias for a concrete discriminator.
`TypedErrorUnion<...>` continues to work for unions of string discriminators.

## Internal Structure

Shared fluent behavior should move into an internal base class so runtime logic
is implemented once:

```ts
export type Result<T, E> = Ok<T> | Err<E>;

abstract class ResultBase<T, E> {
  abstract readonly ok: boolean;
  // shared fluent methods
}

export class Ok<T> extends ResultBase<T, never> {
  readonly ok = true as const;
  constructor(readonly value: T) {
    super();
  }
}

export class Err<E> extends ResultBase<never, E> {
  readonly ok = false as const;
  constructor(readonly error: E) {
    super();
  }
}
```

The helper namespace value should be implemented separately from the union type
to avoid type/runtime conflation:

```ts
export const Result = {
  fromThrowable,
  fromNullable,
  fromPredicate,
  combine,
  combineWithAllErrors,
} satisfies ResultStatic;
```

`ResultAsync<T, E>` remains a class and continues to compose sync and async
results, but its internal conditional types should be reworked to rely on
public extractor utilities rather than private ad hoc types.

## Narrowing and Generic Behavior

### `fromPredicate(...)`

Add a type-guard overload:

```ts
fromPredicate<T, U extends T, E>(
  value: T,
  predicate: (value: T) => value is U,
  error: E,
): Result<U, E>;
```

Keep the boolean-predicate overload for non-narrowing cases.

### `fromNullable(...)`

Keep the current return shape:

```ts
Result<NonNullable<T>, E>
```

The redesign should add type coverage for union inputs so the narrowing remains
reliable across `null | undefined` combinations.

### `fail(...)`

Preserve the exact error subtype instead of collapsing it to the base
`TypedError<TType>`:

```ts
fail<TError extends TypedError<string, any>>(error: TError): Err<TError>;
```

This allows richer domain-specific error shapes such as:

```ts
type ValidationError = TypedError<
  "validation_error",
  { field: string; reason: string }
>;
```

### `isTypedError(...)`

Add overloads so callers can refine both the base contract and a concrete
discriminator:

```ts
isTypedError(error: unknown): error is TypedError<string>;
isTypedError<TType extends string>(
  error: unknown,
  type: TType,
): error is TypedError<TType>;
```

This should make checks like the following narrow correctly:

```ts
if (isTypedError(error, "validation_error")) {
  error.type;
  error.message;
}
```

### Exported Type Helpers

Export a small focused set of helper types for advanced generic consumers:

- `ResultValue<T>`
- `ResultError<T>`
- `ResultOk<T>`
- `ResultErr<T>`
- `AsyncResultValue<T>`
- `AsyncResultError<T>`

These should work against `Result<...>`, `PromiseLike<Result<...>>`, and
`ResultAsync<...>` where appropriate, but the definitions should stay simple
enough to remain predictable.

## Runtime Semantics

The redesign is primarily about public typing and inference.

Runtime behavior should remain unchanged:

- `ok(...)` still produces a successful result.
- `err(...)` and `fail(...)` still produce a failed result.
- `andThen(...)` still short-circuits on the first failure.
- `orElse(...)` still recovers from failures.
- `combine(...)` still stops on the first error.
- `combineWithAllErrors(...)` still collects all errors.
- `ResultAsync` still resolves to one `Result<T, E>` value and short-circuits
  in the same way it does today.

## Compatibility

This redesign is intentionally a breaking public-type change.

Expected impact:

- Code that uses `result.ok` for narrowing should improve immediately.
- Code that already uses `isOk()` and `isErr()` should continue to work.
- Code that treats `Result` as an abstract class identity, runtime constructor,
  or `instanceof` target will need to migrate.
- Code that relies on `fail(...)` returning a collapsed `TypedError<TType>`
  type will become more precise.

This should ship as a major release.

## Testing Strategy

Add or update tests under `test/core` for:

- narrowing with `if (result.ok)` and `if (!result.ok)`
- existing `isOk()` and `isErr()` behavior after the redesign
- `fromPredicate(...)` with both boolean predicates and type predicates
- `fromNullable(...)` with nullable unions
- `fail(...)` preserving richer typed-error shapes
- `isTypedError(error)` narrowing to the base shape
- `isTypedError(error, "x")` narrowing to a concrete discriminator
- tuple inference for `combine(...)`
- tuple inference for `combineWithAllErrors(...)`
- generic helper types such as `ResultValue<T>` and `ResultError<T>`
- representative `ResultAsync` inference paths that depend on the new helper
  types

The test suite should include explicit compile-time assertions where possible,
not only runtime expectations.

## Documentation Impact

Update:

- `README.md` examples to show `if (result.ok)` and typed-error narrowing
- `README.md` API surface for the new helper types and `TypedError` generics
- `examples/core.ts` to demonstrate improved narrowing
- `examples/nest.ts` to demonstrate concrete typed-error checks

Documentation should call out that `Result` remains fluent at runtime even
though its public type is now a discriminated union.

## Recommendation

Proceed with the discriminated-union redesign for `Result<T, E>` and the typed
`details` upgrade for `TypedError`, while keeping the error model otherwise
lightweight.

This delivers the largest improvement in TypeScript ergonomics with the least
runtime churn, and it aligns the library with the mechanisms TypeScript
understands best.
