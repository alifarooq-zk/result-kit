---
description: "Use when modifying Nest adapter files or Nest tests in result-kit. Covers HTTP exception mapping, optional peer dependency handling, and keeping Nest imports out of core."
name: "Result Kit Nest Adapter Rules"
applyTo: "src/nest/**, test/nest/**"
---

# Nest Adapter Rules

- Keep all `@nestjs/common` imports confined to `src/nest/**` and `test/nest/**`.
- Do not move NestJS-specific behavior, types, or exceptions into `src/core/**`.
- Preserve the public split between `@zireal/result-kit` and `@zireal/result-kit/nest`; do not make the root entrypoint depend on NestJS.
- Treat `@nestjs/common` as an optional peer dependency. Changes in the Nest adapter must not leak a runtime dependency into the core package.
- Keep HTTP exception mapping explicit and stable. When changing `toHttpException`, `unwrapOrThrow`, or `unwrapPromise`, verify the status code and response payload shape, especially `code`, `message`, and `details`.
- When mapping domain or typed errors, preserve the current structured error conventions unless the task explicitly changes the API.
- Mirror Nest adapter changes with targeted tests in `test/nest`.
- Use [README.md](../../README.md) and [examples/nest.ts](../../examples/nest.ts) as the canonical package-level references instead of duplicating usage docs here.
