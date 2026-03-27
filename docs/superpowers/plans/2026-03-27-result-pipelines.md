# Result Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fluent sync and async result pipelines that compose existing `Result` values, widen error unions across chained `.andThen(...)` calls, and preserve current runtime failure semantics.

**Architecture:** Introduce a focused `src/core/pipeline.ts` module that holds `ResultPipeline` and `AsyncResultPipeline`, then expose construction through new `ResultKit.pipe(...)` and `ResultKit.pipeAsync(...)` factory methods. Keep pipeline behavior as a thin layer over the existing `Result<T, E>` model so runtime branching and error payload semantics remain unchanged.

**Tech Stack:** TypeScript, Node.js 20+, Vitest, tsdown, Changesets

---

## File Structure

### New files

- `src/core/pipeline.ts`
  Responsibility: Define the sync and async pipeline wrapper classes and their fluent methods.
- `test/core/pipeline.spec.ts`
  Responsibility: Cover sync and async pipeline behavior, including type widening and short-circuit semantics.
- `.changeset/<generated-name>.md`
  Responsibility: Record the consumer-facing feature release as a minor bump.

### Modified files

- `src/core/result-kit.ts`
  Responsibility: Add `pipe(...)` and `pipeAsync(...)` factory methods and wire them to the new pipeline classes.
- `src/core/index.ts`
  Responsibility: Export the new pipeline types from the core surface.
- `README.md`
  Responsibility: Document the fluent pipeline API in the core usage and API surface sections.
- `examples/core.ts`
  Responsibility: Show the recommended pipeline composition style in a runnable example.

## Task 1: Write Sync Pipeline Tests First

**Files:**
- Create: `test/core/pipeline.spec.ts`
- Reference: `src/core/result-kit.ts`
- Reference: `src/core/index.ts`

- [ ] **Step 1: Write failing sync pipeline tests**

```ts
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ResultKit, type Result, type TypedErrorUnion } from '../../src/core';

type AuthError = TypedErrorUnion<'unauthorized'>;
type UserError = TypedErrorUnion<'user_not_found'>;
type BillingError = TypedErrorUnion<'invoice_not_found'>;

describe('ResultPipeline', () => {
  it('starts from a raw value and widens error unions across sync steps', () => {
    const requireSession = (token: string): Result<{ userId: string }, AuthError> =>
      token
        ? ResultKit.success({ userId: 'u_123' })
        : ResultKit.fail({ type: 'unauthorized', message: 'Missing token' });

    const findUser = (
      session: { userId: string },
    ): Result<{ id: string }, UserError> =>
      ResultKit.success({ id: session.userId });

    const loadInvoice = (
      user: { id: string },
    ): Result<{ id: string; userId: string }, BillingError> =>
      ResultKit.success({ id: 'inv_1', userId: user.id });

    const result = ResultKit
      .pipe('token')
      .andThen(requireSession)
      .andThen(findUser)
      .andThen(loadInvoice)
      .done();

    expectTypeOf(result).toEqualTypeOf<
      Result<{ id: string; userId: string }, AuthError | UserError | BillingError>
    >();
    expect(result).toEqual({
      ok: true,
      value: { id: 'inv_1', userId: 'u_123' },
    });
  });

  it('starts from an existing failure result and short-circuits later sync steps', () => {
    let calls = 0;

    const result = ResultKit
      .pipe(
        ResultKit.fail({
          type: 'unauthorized',
          message: 'Missing token',
        }),
      )
      .andThen(() => {
        calls += 1;
        return ResultKit.success({ id: 'u_123' });
      })
      .done();

    expect(calls).toBe(0);
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unauthorized',
        message: 'Missing token',
      },
    });
  });
});
```

- [ ] **Step 2: Run the targeted test file and confirm it fails**

Run: `pnpm exec vitest run test/core/pipeline.spec.ts`
Expected: FAIL with missing `ResultKit.pipe(...)` and missing pipeline types or methods.

- [ ] **Step 3: Commit the red test**

```bash
git add test/core/pipeline.spec.ts
git commit -m "test: add sync pipeline coverage"
```

## Task 2: Implement Sync Pipeline Support

**Files:**
- Create: `src/core/pipeline.ts`
- Modify: `src/core/result-kit.ts`
- Modify: `src/core/index.ts`
- Test: `test/core/pipeline.spec.ts`

- [ ] **Step 1: Create the sync pipeline class in `src/core/pipeline.ts`**

```ts
import { type Result } from './result';

export class ResultPipeline<T, E> {
  constructor(private readonly result: Result<T, E>) {}

  andThen<U, F>(fn: (value: T) => Result<U, F>): ResultPipeline<U, E | F> {
    if (!this.result.ok) {
      return new ResultPipeline<U, E | F>(this.result);
    }

    return new ResultPipeline<U, E | F>(fn(this.result.value));
  }

  done(): Result<T, E> {
    return this.result;
  }
}
```

- [ ] **Step 2: Add `ResultKit.pipe(...)` overloads and implementation**

```ts
static pipe<T>(value: T): ResultPipeline<T, never>;
static pipe<T, E>(result: Result<T, E>): ResultPipeline<T, E>;
static pipe<T, E>(valueOrResult: T | Result<T, E>): ResultPipeline<T, E | never> {
  return this.isSuccess(valueOrResult as Result<T, E>) ||
    this.isFailure(valueOrResult as Result<T, E>)
    ? new ResultPipeline(valueOrResult as Result<T, E>)
    : new ResultPipeline(this.success(valueOrResult as T));
}
```

- [ ] **Step 3: Export the pipeline class from `src/core/index.ts`**

```ts
export { ResultPipeline } from './pipeline';
```

- [ ] **Step 4: Run the targeted sync pipeline tests**

Run: `pnpm exec vitest run test/core/pipeline.spec.ts`
Expected: PASS for sync pipeline cases.

- [ ] **Step 5: Commit the sync implementation**

```bash
git add src/core/pipeline.ts src/core/result-kit.ts src/core/index.ts test/core/pipeline.spec.ts
git commit -m "feat: add sync result pipeline"
```

## Task 3: Write Async Pipeline Tests First

**Files:**
- Modify: `test/core/pipeline.spec.ts`
- Reference: `src/core/pipeline.ts`
- Reference: `src/core/result-kit.ts`

- [ ] **Step 1: Extend `test/core/pipeline.spec.ts` with async pipeline cases**

```ts
it('starts from promises and widens error unions across async steps', async () => {
  type AuthError = TypedErrorUnion<'unauthorized'>;
  type UserError = TypedErrorUnion<'user_not_found'>;

  const requireSessionAsync = async (
    token: string,
  ): Promise<Result<{ userId: string }, AuthError>> =>
    token
      ? ResultKit.success({ userId: 'u_123' })
      : ResultKit.fail({ type: 'unauthorized', message: 'Missing token' });

  const findUserAsync = async (
    session: { userId: string },
  ): Promise<Result<{ id: string }, UserError>> =>
    ResultKit.success({ id: session.userId });

  const result = await ResultKit
    .pipeAsync(Promise.resolve('token'))
    .andThen(requireSessionAsync)
    .andThen(findUserAsync)
    .done();

  expectTypeOf(result).toEqualTypeOf<
    Result<{ id: string }, AuthError | UserError>
  >();
  expect(result).toEqual({
    ok: true,
    value: { id: 'u_123' },
  });
});

it('short-circuits later async steps after the first failure', async () => {
  let calls = 0;

  const result = await ResultKit
    .pipeAsync(
      Promise.resolve(
        ResultKit.fail({
          type: 'unauthorized',
          message: 'Missing token',
        }),
      ),
    )
    .andThen(async () => {
      calls += 1;
      return ResultKit.success({ id: 'u_123' });
    })
    .done();

  expect(calls).toBe(0);
  expect(result).toEqual({
    ok: false,
    error: {
      type: 'unauthorized',
      message: 'Missing token',
    },
  });
});
```

- [ ] **Step 2: Run the targeted test file and confirm async cases fail**

Run: `pnpm exec vitest run test/core/pipeline.spec.ts`
Expected: FAIL with missing `ResultKit.pipeAsync(...)` or async pipeline methods.

- [ ] **Step 3: Commit the red async test**

```bash
git add test/core/pipeline.spec.ts
git commit -m "test: add async pipeline coverage"
```

## Task 4: Implement Async Pipeline Support

**Files:**
- Modify: `src/core/pipeline.ts`
- Modify: `src/core/result-kit.ts`
- Modify: `src/core/index.ts`
- Test: `test/core/pipeline.spec.ts`

- [ ] **Step 1: Add `AsyncResultPipeline` to `src/core/pipeline.ts`**

```ts
export class AsyncResultPipeline<T, E> {
  constructor(private readonly result: Promise<Result<T, E>>) {}

  andThen<U, F>(
    fn: (value: T) => Promise<Result<U, F>>,
  ): AsyncResultPipeline<U, E | F> {
    return new AsyncResultPipeline<U, E | F>(
      this.result.then((result) => {
        if (!result.ok) {
          return result;
        }

        return fn(result.value);
      }),
    );
  }

  done(): Promise<Result<T, E>> {
    return this.result;
  }
}
```

- [ ] **Step 2: Add `ResultKit.pipeAsync(...)` overloads and input normalization**

```ts
static pipeAsync<T>(value: T): AsyncResultPipeline<T, never>;
static pipeAsync<T>(value: Promise<T>): AsyncResultPipeline<T, never>;
static pipeAsync<T, E>(result: Result<T, E>): AsyncResultPipeline<T, E>;
static pipeAsync<T, E>(result: Promise<Result<T, E>>): AsyncResultPipeline<T, E>;
```

Implementation note: normalize raw values and promises into `Promise<Result<T, E>>`
before constructing `AsyncResultPipeline`.

- [ ] **Step 3: Export `AsyncResultPipeline` from `src/core/index.ts`**

```ts
export { AsyncResultPipeline, ResultPipeline } from './pipeline';
```

- [ ] **Step 4: Run the targeted pipeline test file**

Run: `pnpm exec vitest run test/core/pipeline.spec.ts`
Expected: PASS for both sync and async pipeline cases.

- [ ] **Step 5: Commit the async implementation**

```bash
git add src/core/pipeline.ts src/core/result-kit.ts src/core/index.ts test/core/pipeline.spec.ts
git commit -m "feat: add async result pipeline"
```

## Task 5: Document the New API

**Files:**
- Modify: `README.md`
- Modify: `examples/core.ts`
- Reference: `src/core/index.ts`

- [ ] **Step 1: Add pipeline examples and API entries to `README.md`**

Update the core usage section with a fluent composition example:

```ts
const result = ResultKit
  .pipe(token)
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId))
  .done();
```

Update the API surface list to include:

```md
- `ResultPipeline`, `AsyncResultPipeline`
- `ResultKit.pipe`, `pipeAsync`
```

- [ ] **Step 2: Replace `examples/core.ts` with a pipeline-centric example**

Use an example that starts from a raw token, chains at least two result-producing
functions, and prints a final matched value from `.done()`.

- [ ] **Step 3: Run focused verification for docs-adjacent code**

Run: `pnpm exec vitest run test/core/pipeline.spec.ts test/core/result-kit.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit the documentation updates**

```bash
git add README.md examples/core.ts
git commit -m "docs: add result pipeline usage"
```

## Task 6: Add Changeset and Run Full Verification

**Files:**
- Create: `.changeset/<generated-name>.md`
- Verify: `test/core/pipeline.spec.ts`
- Verify: `test/core/result-kit.spec.ts`
- Verify: package build and types

- [ ] **Step 1: Generate a changeset for the consumer-facing feature**

Run: `pnpm changeset`
Expected: interactive prompt creates a new file under `.changeset/`

Choose:
- package: `@zireal/result-kit`
- bump: `minor`

Suggested summary:

```md
Add fluent sync and async result pipelines for composing result-producing
workflows with automatic error union widening.
```

- [ ] **Step 2: Verify the generated changeset content**

Expected file shape:

```md
---
"@zireal/result-kit": minor
---

Add fluent sync and async result pipelines for composing result-producing
workflows with automatic error union widening.
```

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Run type checking**

Run: `pnpm check`
Expected: PASS

- [ ] **Step 5: Run the package build**

Run: `pnpm build`
Expected: PASS with updated core exports included in `dist/`

- [ ] **Step 6: Review final worktree**

Run: `git status --short`
Expected: only the intended source, test, docs, and changeset files are modified.

- [ ] **Step 7: Commit the release-ready feature**

```bash
git add src/core/pipeline.ts src/core/result-kit.ts src/core/index.ts test/core/pipeline.spec.ts README.md examples/core.ts .changeset/*.md
git commit -m "feat: add fluent result pipelines"
```

## Notes For Execution

- Keep `Result<T, E>` unchanged throughout the implementation.
- Do not add runtime error accumulation or boundary context wrappers in this plan.
- Prefer overloads on `pipe(...)` and `pipeAsync(...)` instead of broad conditional generic signatures.
- Keep the async pipeline strict in v1: `.andThen(...)` accepts async result-producing steps only.
- Because `pipe(...)` and `pipeAsync(...)` accept both raw values and existing
  `Result` instances, normalization is necessarily shape-based at runtime.
  Document or test the chosen behavior for raw inputs that structurally look
  like `{ ok: boolean, value | error }`.
