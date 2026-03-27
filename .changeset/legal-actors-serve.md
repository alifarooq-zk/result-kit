---
"@zireal/result-kit": major
---

Replace the v1 static-helper and pipeline model with a fluent class-based result API.

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
