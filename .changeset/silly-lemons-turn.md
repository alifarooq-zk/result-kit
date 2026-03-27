---
"@zireal/result-kit": major
---

Redesign `Result` as a discriminated union and improve the package's type-system ergonomics.

This breaking change replaces the abstract `Result` class type with the public
union `Ok<T> | Err<E>`, which means consumers can now narrow directly on
`result.ok` without losing fluent instance methods on concrete results.

`TypedError` now supports typed `details`, `fail(...)` preserves richer error
subtypes, and the core helpers expose stronger inference for predicate
narrowing, typed-error guards, tuple combination, and async result chaining.

Consumers should update any code that relied on `Result` as a class identity or
`instanceof` target and prefer control-flow checks like `if (result.ok)` or
`isTypedError(error, "validation_error")` for narrowing.
