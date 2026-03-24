# @alifarooq/result-kit

Type-safe result and structured error utilities for TypeScript, with optional NestJS adapters.

## Packages

- `@alifarooq/result-kit`
- `@alifarooq/result-kit/core`
- `@alifarooq/result-kit/nest`

The package root re-exports the framework-agnostic core only. Nest-specific helpers live in `@alifarooq/result-kit/nest`.

## Installation

```bash
pnpm add @alifarooq/result-kit
```

If you use the Nest adapter:

```bash
pnpm add @nestjs/common
```

## Core Concepts

### `Result<T, E>`

```ts
type Result<T, E> = Success<T> | Failure<E>;
```

Use `Result` to model success and failure explicitly rather than throwing through your service layer.

### `TypedError`

```ts
interface TypedError<TType extends string = string> {
  type: TType;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}
```

`TypedError` is the package’s structured error convention. You can still use any `E` with `Result<T, E>`, but `TypedError` works well for application and domain failures.

## Core Usage

```ts
import { ResultKit, type Result, type TypedErrorUnion } from '@alifarooq/result-kit';

type UserError = TypedErrorUnion<'not_found' | 'validation_error'>;

const findUser = (id: string): Result<{ id: string }, UserError> => {
  if (!id.trim()) {
    return ResultKit.fail({
      type: 'validation_error',
      message: 'id is required',
    });
  }

  if (id !== '123') {
    return ResultKit.fail({
      type: 'not_found',
      message: 'User not found',
      details: { id },
    });
  }

  return ResultKit.success({ id });
};
```

## Nest Usage

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { unwrapOrThrow } from '@alifarooq/result-kit/nest';

@Controller('users')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return unwrapOrThrow(await this.service.findUser(id));
  }
}
```

Use a mapper when your domain error types need custom HTTP status behavior:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { unwrapOrThrow } from '@alifarooq/result-kit/nest';
import { ResultKit } from '@alifarooq/result-kit';

const user = unwrapOrThrow(result, {
  mapError: (error) => {
    if (!ResultKit.isTypedError(error)) return undefined;
    if (error.type === 'validation_error') {
      return new BadRequestException(error.message);
    }
    if (error.type === 'not_found') {
      return new NotFoundException(error.message);
    }

    return undefined;
  },
});
```

## API Surface

### Core

- `TypedError`, `TypedErrorOf`, `TypedErrorUnion`
- `Success`, `Failure`, `Result`
- `ResultKit.success`, `failure`, `fail`
- `ResultKit.isSuccess`, `isFailure`, `isTypedError`
- `ResultKit.map`, `mapAsync`, `mapError`, `mapErrorAsync`
- `ResultKit.andThen`, `andThenAsync`, `orElse`, `orElseAsync`
- `ResultKit.match`, `matchAsync`
- `ResultKit.unwrap`, `unwrapSuccess`, `unwrapFailure`, `unwrapOr`, `unwrapOrElse`, `unwrapOrElseAsync`
- `ResultKit.combine`, `combineAsync`, `combineWithAllErrors`, `combineWithAllErrorsAsync`
- `ResultKit.fromNullable`, `fromPredicate`, `fromPromise`, `fromThrowable`, `fromThrowableAsync`
- `ResultKit.partition`, `filterSuccesses`, `filterFailures`, `toNullable`, `flatten`

### Nest

- `toHttpException`
- `unwrapOrThrow`
- `unwrapPromise`

## Examples

- [`examples/core.ts`](./examples/core.ts)
- [`examples/nest.ts`](./examples/nest.ts)
