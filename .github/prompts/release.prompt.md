---
description: "Prepare a publishable result-kit change by selecting the correct patch, minor, or major bump, creating a changeset, and verifying entrypoints plus build output."
name: "Prepare Release Change"
argument-hint: "Describe the change being prepared for release"
agent: "agent"
---

Prepare this result-kit change for release: ${input:Describe the change being prepared for release}

Follow this workflow:

1. Inspect the current workspace changes and determine whether the published impact is `patch`, `minor`, or `major`.
2. Explain the version bump choice in terms of consumer impact.
3. If the change is consumer-facing, create a changeset with `pnpm changeset` using the selected bump type.
4. If the change is internal-only, state why a changeset is not needed instead of creating one.
5. Verify package entrypoints and exports remain consistent across [src/index.ts](../../src/index.ts), [src/core/index.ts](../../src/core/index.ts), [src/nest/index.ts](../../src/nest/index.ts), [tsdown.config.ts](../../tsdown.config.ts), and [package.json](../../package.json).
6. Run `pnpm test` and `pnpm check`.
7. Run `pnpm build` when public exports, packaging, or release-facing files changed.
8. Summarize what was verified, what changeset was created, and any remaining release risks.

Keep the release preparation focused. Do not make unrelated code changes while performing this prompt.
