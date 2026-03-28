---
"@zireal/result-kit": major
---

Redesign the fluent `Result` and `ResultAsync` method typings to preserve
concrete callback inference across deep chains, including mixed `Result`,
`ResultAsync`, and `PromiseLike<Result>` flows. This keeps strict consumer
TypeScript and ESLint type-safety checks from degrading chained callback
payloads to `any` or `unknown` in complex service pipelines.
