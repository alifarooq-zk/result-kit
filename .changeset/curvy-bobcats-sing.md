---
"@zireal/result-kit": minor
---

Add back `ResultKit` as a branded static facade over the new fluent v2 API.

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
