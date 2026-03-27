import type { TypedError } from "./error";

export type Result<T, E> = Ok<T> | Err<E>;

type AsyncResultInput<T, E> =
  | Result<T, E>
  | PromiseLike<Result<T, E>>
  | ResultAsync<T, E>;

type ResolvedAsyncResult<TValue extends AsyncResultInput<unknown, unknown>> =
  TValue extends PromiseLike<infer TResult>
    ? Extract<TResult, Result<unknown, unknown>>
    : Extract<TValue, Result<unknown, unknown>>;

type AsyncInputValue<TValue extends AsyncResultInput<unknown, unknown>> =
  ResultValue<ResolvedAsyncResult<TValue>>;

type AsyncInputError<TValue extends AsyncResultInput<unknown, unknown>> =
  ResultError<ResolvedAsyncResult<TValue>>;

export type ResultValue<TValue extends Result<unknown, unknown>> =
  TValue extends Ok<infer T> ? T : never;

export type ResultError<TValue extends Result<unknown, unknown>> =
  TValue extends Err<infer E> ? E : never;

export type ResultOk<TValue extends Result<unknown, unknown>> =
  TValue extends Ok<infer T> ? Ok<T> : never;

export type ResultErr<TValue extends Result<unknown, unknown>> =
  TValue extends Err<infer E> ? Err<E> : never;

export type AsyncResultValue<TValue extends PromiseLike<Result<unknown, unknown>>> =
  TValue extends PromiseLike<infer TResult>
    ? TResult extends Result<unknown, unknown>
      ? ResultValue<TResult>
      : never
    : never;

export type AsyncResultError<TValue extends PromiseLike<Result<unknown, unknown>>> =
  TValue extends PromiseLike<infer TResult>
    ? TResult extends Result<unknown, unknown>
      ? ResultError<TResult>
      : never
    : never;

const resolveAsyncResult = <T, E>(
  input: AsyncResultInput<T, E>,
): Promise<Result<T, E>> => Promise.resolve(input);

abstract class ResultBase<T, E> {
  abstract readonly ok: boolean;

  isOk(): this is Ok<T> {
    return this.ok;
  }

  isErr(): this is Err<E> {
    return !this.ok;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isOk()) {
      return ok(fn(this.value));
    }

    if (this.isErr()) {
      return err(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isErr()) {
      return err(fn(this.error));
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    if (this.isOk()) {
      return fn(this.value);
    }

    if (this.isErr()) {
      return err<E | F>(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  orElse<U, F>(fn: (error: E) => Result<U, F>): Result<T | U, F> {
    if (this.isErr()) {
      return fn(this.error);
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }

  match<A, B>(onOk: (value: T) => A, onErr: (error: E) => B): A | B {
    if (this.isOk()) {
      return onOk(this.value);
    }

    if (this.isErr()) {
      return onErr(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  unwrapOr<TDefault>(defaultValue: TDefault): T | TDefault {
    if (this.isOk()) {
      return this.value;
    }

    return defaultValue;
  }

  unwrapOrElse<TDefault>(fn: (error: E) => TDefault): T | TDefault {
    if (this.isErr()) {
      return fn(this.error);
    }

    if (this.isOk()) {
      return this.value;
    }

    throw new Error("Unreachable result branch");
  }

  asyncMap<U>(fn: (value: T) => U | PromiseLike<U>): ResultAsync<U, E> {
    if (this.isErr()) {
      return new ResultAsync(Promise.resolve(err(this.error)));
    }

    if (this.isOk()) {
      return new ResultAsync(
        Promise.resolve(fn(this.value)).then((value) => ok(value)),
      );
    }

    throw new Error("Unreachable result branch");
  }

  asyncAndThen<TNext extends AsyncResultInput<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<AsyncInputValue<TNext>, E | AsyncInputError<TNext>> {
    if (this.isErr()) {
      return new ResultAsync(
        Promise.resolve(err<E | AsyncInputError<TNext>>(this.error)),
      );
    }

    if (this.isOk()) {
      return new ResultAsync(
        resolveAsyncResult(fn(this.value)) as Promise<
          Result<AsyncInputValue<TNext>, E | AsyncInputError<TNext>>
        >,
      );
    }

    throw new Error("Unreachable result branch");
  }

  andTee(fn: (value: T) => unknown): Result<T, E> {
    if (this.isOk()) {
      try {
        fn(this.value);
      } catch {
        // Tee callbacks are observational and must not affect the main result.
      }
    }

    return this as unknown as Result<T, E>;
  }

  orTee(fn: (error: E) => unknown): Result<T, E> {
    if (this.isErr()) {
      try {
        fn(this.error);
      } catch {
        // Tee callbacks are observational and must not affect the main result.
      }
    }

    return this as unknown as Result<T, E>;
  }

  andThrough<F>(fn: (value: T) => Result<unknown, F>): Result<T, E | F> {
    if (this.isErr()) {
      return err<E | F>(this.error);
    }

    if (this.isOk()) {
      const next = fn(this.value);
      return next.isErr() ? err<E | F>(next.error) : ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }
}

export class Ok<T> extends ResultBase<T, never> {
  readonly ok = true as const;

  constructor(readonly value: T) {
    super();
  }
}

export class Err<E> extends ResultBase<never, E> {
  readonly ok = false as const;

  constructor(readonly error: E) {
    super();
  }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value);

export const err = <E>(error: E): Err<E> => new Err(error);

export const fail = <TError extends TypedError<string, any>>(
  error: TError,
): Err<TError> => err(error);

export const okAsync = <T>(value: T): ResultAsync<T, never> =>
  new ResultAsync(Promise.resolve(ok(value)));

export const errAsync = <E>(error: E): ResultAsync<never, E> =>
  new ResultAsync(Promise.resolve(err(error)));

function fromThrowable<Args extends unknown[], T, E>(
  fn: (...args: Args) => T,
  errorFn: (error: unknown) => E,
): (...args: Args) => Result<T, E> {
  return (...args) => {
    try {
      return ok(fn(...args));
    } catch (error) {
      return err(errorFn(error));
    }
  };
}

function fromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<NonNullable<T>, E> {
  return value == null ? err(error) : ok(value);
}

function fromPredicate<T, U extends T, E>(
  value: T,
  predicate: (value: T) => value is U,
  error: E,
): Result<U, E>;
function fromPredicate<T, E>(
  value: T,
  predicate: (value: T) => boolean,
  error: E,
): Result<T, E>;
function fromPredicate<T, E>(
  value: T,
  predicate: (value: T) => boolean,
  error: E,
): Result<T, E> {
  return predicate(value) ? ok(value) : err(error);
}

function combine<const TResults extends readonly Result<unknown, unknown>[]>(
  results: TResults,
): Result<
  { -readonly [K in keyof TResults]: ResultValue<TResults[K]> },
  ResultError<TResults[number]>
>;
function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;
function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }

    if (result.isOk()) {
      values.push(result.value);
    }
  }

  return ok(values);
}

function combineWithAllErrors<
  const TResults extends readonly Result<unknown, unknown>[],
>(
  results: TResults,
): Result<
  { -readonly [K in keyof TResults]: ResultValue<TResults[K]> },
  ResultError<TResults[number]>[]
>;
function combineWithAllErrors<T, E>(
  results: readonly Result<T, E>[],
): Result<T[], E[]>;
function combineWithAllErrors<T, E>(
  results: readonly Result<T, E>[],
): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.isErr()) {
      errors.push(result.error);
    }

    if (result.isOk()) {
      values.push(result.value);
    }
  }

  return errors.length > 0 ? err(errors) : ok(values);
}

export interface ResultStatic {
  readonly fromThrowable: typeof fromThrowable;
  readonly fromNullable: typeof fromNullable;
  readonly fromPredicate: typeof fromPredicate;
  readonly combine: typeof combine;
  readonly combineWithAllErrors: typeof combineWithAllErrors;
}

export const Result: ResultStatic = {
  fromThrowable,
  fromNullable,
  fromPredicate,
  combine,
  combineWithAllErrors,
};

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  constructor(private readonly promise: Promise<Result<T, E>>) {}

  map<U>(fn: (value: T) => U | PromiseLike<U>): ResultAsync<U, E> {
    return new ResultAsync(
      this.promise.then((result) => {
        if (result.isOk()) {
          return Promise.resolve(fn(result.value)).then((value) => ok(value));
        }

        if (result.isErr()) {
          return err(result.error);
        }

        throw new Error("Unreachable result branch");
      }),
    );
  }

  mapErr<F>(fn: (error: E) => F | PromiseLike<F>): ResultAsync<T, F> {
    return new ResultAsync(
      this.promise.then((result) => {
        if (result.isErr()) {
          return Promise.resolve(fn(result.error)).then((error) => err(error));
        }

        if (result.isOk()) {
          return ok(result.value);
        }

        throw new Error("Unreachable result branch");
      }),
    );
  }

  andThen<TNext extends AsyncResultInput<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<AsyncInputValue<TNext>, E | AsyncInputError<TNext>> {
    return new ResultAsync(
      this.promise.then(
        async (
          result,
        ): Promise<
          Result<AsyncInputValue<TNext>, E | AsyncInputError<TNext>>
        > => {
          if (result.isOk()) {
            return resolveAsyncResult(fn(result.value)) as Promise<
              Result<AsyncInputValue<TNext>, E | AsyncInputError<TNext>>
            >;
          }

          if (result.isErr()) {
            return err<E | AsyncInputError<TNext>>(result.error);
          }

          throw new Error("Unreachable result branch");
        },
      ),
    );
  }

  orElse<TNext extends AsyncResultInput<unknown, unknown>>(
    fn: (error: E) => TNext,
  ): ResultAsync<T | AsyncInputValue<TNext>, AsyncInputError<TNext>> {
    return new ResultAsync(
      this.promise.then(
        async (
          result,
        ): Promise<
          Result<T | AsyncInputValue<TNext>, AsyncInputError<TNext>>
        > => {
          if (result.isErr()) {
            return resolveAsyncResult(fn(result.error)) as Promise<
              Result<T | AsyncInputValue<TNext>, AsyncInputError<TNext>>
            >;
          }

          if (result.isOk()) {
            return ok(result.value);
          }

          throw new Error("Unreachable result branch");
        },
      ),
    );
  }

  match<A, B>(
    onOk: (value: T) => A | PromiseLike<A>,
    onErr: (error: E) => B | PromiseLike<B>,
  ): Promise<A | B> {
    return this.promise.then((result) => {
      if (result.isOk()) {
        return onOk(result.value);
      }

      if (result.isErr()) {
        return onErr(result.error);
      }

      throw new Error("Unreachable result branch");
    });
  }

  unwrapOr<TDefault>(defaultValue: TDefault): Promise<T | TDefault> {
    return this.promise.then((result) => result.unwrapOr(defaultValue));
  }

  andTee(fn: (value: T) => unknown | PromiseLike<unknown>): ResultAsync<T, E> {
    return new ResultAsync(
      this.promise.then(async (result) => {
        if (result.isOk()) {
          try {
            await fn(result.value);
          } catch {
            // Tee callbacks are observational and must not affect the main result.
          }
        }

        return result;
      }),
    );
  }

  orTee(fn: (error: E) => unknown | PromiseLike<unknown>): ResultAsync<T, E> {
    return new ResultAsync(
      this.promise.then(async (result) => {
        if (result.isErr()) {
          try {
            await fn(result.error);
          } catch {
            // Tee callbacks are observational and must not affect the main result.
          }
        }

        return result;
      }),
    );
  }

  andThrough<TNext extends AsyncResultInput<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<T, E | AsyncInputError<TNext>> {
    return new ResultAsync(
      this.promise.then(async (result) => {
        if (result.isOk()) {
          const next = (await resolveAsyncResult(fn(result.value))) as Result<
            AsyncInputValue<TNext>,
            AsyncInputError<TNext>
          >;
          return next.isErr()
            ? err<E | AsyncInputError<TNext>>(next.error)
            : ok(result.value);
        }

        if (result.isErr()) {
          return err<E | AsyncInputError<TNext>>(result.error);
        }

        throw new Error("Unreachable result branch");
      }),
    );
  }

  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.promise.then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  static fromPromise<T, E>(
    promise: PromiseLike<T>,
    errorFn: (error: unknown) => E,
  ): ResultAsync<T, E> {
    return new ResultAsync(
      Promise.resolve(promise)
        .then((value) => ok(value))
        .catch((error) => err(errorFn(error))),
    );
  }

  static fromThrowable<Args extends unknown[], T, E>(
    fn: (...args: Args) => PromiseLike<T>,
    errorFn: (error: unknown) => E,
  ): (...args: Args) => ResultAsync<T, E> {
    return (...args) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() => fn(...args)),
        errorFn,
      );
  }

  static combine<
    const TResults extends readonly PromiseLike<Result<unknown, unknown>>[],
  >(
    results: TResults,
  ): ResultAsync<
    { -readonly [K in keyof TResults]: AsyncResultValue<TResults[K]> },
    AsyncResultError<TResults[number]>
  >;
  static combine<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E>;
  static combine<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E> {
    return new ResultAsync(
      Promise.all(results.map((result) => Promise.resolve(result))).then(
        (resolved) => combine(resolved as Result<T, E>[]),
      ),
    ) as ResultAsync<T[], E>;
  }

  static combineWithAllErrors<
    const TResults extends readonly PromiseLike<Result<unknown, unknown>>[],
  >(
    results: TResults,
  ): ResultAsync<
    { -readonly [K in keyof TResults]: AsyncResultValue<TResults[K]> },
    AsyncResultError<TResults[number]>[]
  >;
  static combineWithAllErrors<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E[]>;
  static combineWithAllErrors<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E[]> {
    return new ResultAsync(
      Promise.all(results.map((result) => Promise.resolve(result))).then(
        (resolved) => combineWithAllErrors(resolved as Result<T, E>[]),
      ),
    ) as ResultAsync<T[], E[]>;
  }
}
