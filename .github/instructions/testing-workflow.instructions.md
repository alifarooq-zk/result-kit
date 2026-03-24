---
description: "Use when changing src/core or src/nest in result-kit. Enforces Vitest test updates, coverage-minded changes, and required pnpm test plus pnpm check verification before finishing."
name: "Result Kit Testing Workflow"
applyTo: "src/core/**, src/nest/**"
---

# Testing Workflow

- When you change code under `src/core` or `src/nest`, add or update the matching Vitest coverage under `test/core` or `test/nest` in the same task.
- Cover the behavior you changed, including success paths, failure paths, and any newly introduced edge cases.
- Keep tests aligned with the package split: core behavior belongs in `test/core`, Nest adapter behavior belongs in `test/nest`.
- Before finishing, run `pnpm test` and `pnpm check` and confirm the outcome from command output.
- If the change affects public exports, packaging, or release behavior, also run `pnpm build`.
- Prefer focused test additions over broad rewrites of unrelated specs.
