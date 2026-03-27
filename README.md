# @zireal/result-kit

Type-safe fluent results for TypeScript, with `TypedError` as the default error model and an optional NestJS adapter.

## Packages

- `@zireal/result-kit`
- `@zireal/result-kit/core`
- `@zireal/result-kit/nest`

The package root re-exports the framework-agnostic core only. Nest-specific helpers live in `@zireal/result-kit/nest`.

## Installation

```bash
pnpm add @zireal/result-kit
```

If you use the Nest adapter:

```bash
pnpm add @nestjs/common
```

## Core Concepts

### `TypedError`

```ts
interface TypedError<TType extends string = string> {
  type: TType;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}
```

`TypedError` is the package's default error convention. It gives failures a stable `type` discriminator while preserving a human-readable `message` and optional structured metadata.

Use `TypedErrorUnion<...>` to model domain-specific failures:

```ts
type UserError = TypedErrorUnion<"not_found" | "validation_error">;
```

### `Result<T, E>`

`Result<T, E>` is a fluent result object with two concrete variants:

- `Ok<T>` for success values
- `Err<E>` for failure values

Construct results with:

- `ok(value)` for success
- `fail(typedError)` for the default `TypedError` failure path
- `err(error)` for generic non-typed failures
- `ResultKit.ok(...)`, `ResultKit.fail(...)`, and `ResultKit.err(...)` when you want the same fluent behavior through the package-branded facade

## Core Usage

```ts
import {
  ResultKit,
  fail,
  ok,
  type Result,
  type TypedErrorUnion,
} from "@zireal/result-kit";

type UserError = TypedErrorUnion<"not_found" | "validation_error">;

const findUser = (id: string): Result<{ id: string }, UserError> => {
  if (!id.trim()) {
    return fail({
      type: "validation_error",
      message: "id is required",
    });
  }

  if (id !== "123") {
    return fail({
      type: "not_found",
      message: "User not found",
      details: { id },
    });
  }

  return ok({ id });
};
```

Compose result-producing services directly on the instance:

```ts
type AuthError = TypedErrorUnion<"missing_token">;

const requireSession = (
  token: string,
): Result<{ userId: string }, AuthError> => {
  if (!token.trim()) {
    return fail({
      type: "missing_token",
      message: "token is required",
    });
  }

  return ok({ userId: "123" });
};

const result = ok("session-token")
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId));

const message = result.match(
  (user) => user.id,
  (error) => error.message,
);

const branded = ResultKit
  .ok("session-token")
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId));
```

## Async Usage

Use `ResultAsync` for fluent async composition:

```ts
import { ResultAsync, fail, ok, type TypedErrorUnion } from "@zireal/result-kit";

type ApiError = TypedErrorUnion<"network_error">;

const fetchUser = (id: string) =>
  ResultAsync.fromPromise(fetch(`/users/${id}`).then((res) => res.json()), () =>
    ({
      type: "network_error",
      message: "Unable to fetch user",
    }) satisfies ApiError,
  );

const user = await fetchUser("123")
  .andThen((payload) => ok(payload.user))
  .unwrapOr({ id: "fallback" });
```

## Nest Usage

```ts
import { Controller, Get, Param } from "@nestjs/common";
import { type Result, type TypedErrorUnion } from "@zireal/result-kit";
import { unwrapOrThrow } from "@zireal/result-kit/nest";

type UserError = TypedErrorUnion<"not_found" | "validation_error">;

class UserService {
  async findUser(id: string): Promise<Result<{ id: string }, UserError>> {
    // return ok(...) or fail(...)
  }
}

@Controller("users")
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get(":id")
  async getUser(@Param("id") id: string) {
    return unwrapOrThrow(await this.service.findUser(id));
  }
}
```

Use a mapper when your domain errors need custom HTTP status behavior:

```ts
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { isTypedError } from "@zireal/result-kit";
import { unwrapOrThrow } from "@zireal/result-kit/nest";

const user = unwrapOrThrow(result, {
  mapError: (error) => {
    if (!isTypedError(error)) return undefined;
    if (error.type === "validation_error") {
      return new BadRequestException(error.message);
    }
    if (error.type === "not_found") {
      return new NotFoundException(error.message);
    }

    return undefined;
  },
});
```

## API Surface

### Core

- `TypedError`, `TypedErrorOf`, `TypedErrorUnion`, `isTypedError`
- `Ok`, `Err`, `Result`, `ResultAsync`
- `ok`, `fail`, `err`, `okAsync`, `errAsync`
- `ResultKit`
- `Result.fromThrowable`, `Result.fromNullable`, `Result.fromPredicate`
- `Result.combine`, `Result.combineWithAllErrors`
- `ResultAsync.fromPromise`, `ResultAsync.fromThrowable`
- `ResultAsync.combine`, `ResultAsync.combineWithAllErrors`

### Result instance methods

- `isOk`, `isErr`
- `map`, `mapErr`
- `andThen`, `orElse`
- `match`
- `unwrapOr`, `unwrapOrElse`
- `asyncMap`, `asyncAndThen`
- `andTee`, `orTee`, `andThrough`

### ResultAsync instance methods

- `map`, `mapErr`
- `andThen`, `orElse`
- `match`
- `unwrapOr`
- `andTee`, `orTee`, `andThrough`
- `then`

### Nest

- `toHttpException`
- `unwrapOrThrow`
- `unwrapPromise`

## Examples

- [`examples/core.ts`](./examples/core.ts)
- [`examples/nest.ts`](./examples/nest.ts)
