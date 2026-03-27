import type { TypedError } from './error';

type AsyncResultInput<T, E> =
  | Result<T, E>
  | PromiseLike<Result<T, E>>
  | ResultAsync<T, E>;

type OkValue<TValue> = TValue extends Result<infer T, any> ? T : never;
type ErrValue<TValue> = TValue extends Result<any, infer E> ? E : never;
type AsyncOkValue<TValue> = TValue extends PromiseLike<Result<infer T, any>>
  ? T
  : never;
type AsyncErrValue<TValue> = TValue extends PromiseLike<Result<any, infer E>>
  ? E
  : never;

const resolveAsyncResult = <T, E>(
  input: AsyncResultInput<T, E>,
): Promise<Result<T, E>> => Promise.resolve(input);

export abstract class Result<T, E> {
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

    throw new Error('Unreachable result branch');
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isErr()) {
      return err(fn(this.error));
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error('Unreachable result branch');
  }

  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    if (this.isOk()) {
      return fn(this.value);
    }

    if (this.isErr()) {
      return err<E | F>(this.error);
    }

    throw new Error('Unreachable result branch');
  }

  orElse<U, F>(fn: (error: E) => Result<U, F>): Result<T | U, F> {
    if (this.isErr()) {
      return fn(this.error);
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error('Unreachable result branch');
  }

  match<A, B>(
    onOk: (value: T) => A,
    onErr: (error: E) => B,
  ): A | B {
    if (this.isOk()) {
      return onOk(this.value);
    }

    if (this.isErr()) {
      return onErr(this.error);
    }

    throw new Error('Unreachable result branch');
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

    throw new Error('Unreachable result branch');
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

    throw new Error('Unreachable result branch');
  }

  asyncAndThen<U, F>(
    fn: (value: T) => AsyncResultInput<U, F>,
  ): ResultAsync<U, E | F> {
    if (this.isErr()) {
      return new ResultAsync(Promise.resolve(err<E | F>(this.error)));
    }

    if (this.isOk()) {
      return new ResultAsync(resolveAsyncResult(fn(this.value)));
    }

    throw new Error('Unreachable result branch');
  }

  andTee(fn: (value: T) => unknown): Result<T, E> {
    if (this.isOk()) {
      try {
        fn(this.value);
      } catch {
        // Tee callbacks are observational and must not affect the main result.
      }
    }

    return this;
  }

  orTee(fn: (error: E) => unknown): Result<T, E> {
    if (this.isErr()) {
      try {
        fn(this.error);
      } catch {
        // Tee callbacks are observational and must not affect the main result.
      }
    }

    return this;
  }

  andThrough<F>(fn: (value: T) => Result<unknown, F>): Result<T, E | F> {
    if (this.isErr()) {
      return err<E | F>(this.error);
    }

    if (this.isOk()) {
      const next = fn(this.value);
      return next.isErr() ? err<E | F>(next.error) : ok(this.value);
    }

    throw new Error('Unreachable result branch');
  }

  static fromThrowable<Args extends unknown[], T, E>(
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

  static fromNullable<T, E>(
    value: T | null | undefined,
    error: E,
  ): Result<NonNullable<T>, E> {
    return value == null ? err(error) : ok(value);
  }

  static fromPredicate<T, E>(
    value: T,
    predicate: (value: T) => boolean,
    error: E,
  ): Result<T, E> {
    return predicate(value) ? ok(value) : err(error);
  }

  static combine<const TResults extends readonly Result<unknown, unknown>[]>(
    results: TResults,
  ): Result<
    { [K in keyof TResults]: OkValue<TResults[K]> },
    ErrValue<TResults[number]>
  >;
  static combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;
  static combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
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

  static combineWithAllErrors<
    const TResults extends readonly Result<unknown, unknown>[],
  >(
    results: TResults,
  ): Result<
    { [K in keyof TResults]: OkValue<TResults[K]> },
    ErrValue<TResults[number]>[]
  >;
  static combineWithAllErrors<T, E>(
    results: readonly Result<T, E>[],
  ): Result<T[], E[]>;
  static combineWithAllErrors<T, E>(
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
}

export class Ok<T> extends Result<T, never> {
  readonly ok = true;

  constructor(readonly value: T) {
    super();
  }
}

export class Err<E> extends Result<never, E> {
  readonly ok = false;

  constructor(readonly error: E) {
    super();
  }
}

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

        throw new Error('Unreachable result branch');
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

        throw new Error('Unreachable result branch');
      }),
    );
  }

  andThen<U, F>(
    fn: (value: T) => AsyncResultInput<U, F>,
  ): ResultAsync<U, E | F> {
    return new ResultAsync(
      this.promise.then(async (result): Promise<Result<U, E | F>> => {
        if (result.isOk()) {
          return resolveAsyncResult(fn(result.value));
        }

        if (result.isErr()) {
          return err<E | F>(result.error);
        }

        throw new Error('Unreachable result branch');
      }),
    );
  }

  orElse<U, F>(
    fn: (error: E) => AsyncResultInput<U, F>,
  ): ResultAsync<T | U, F> {
    return new ResultAsync(
      this.promise.then(async (result): Promise<Result<T | U, F>> => {
        if (result.isErr()) {
          return resolveAsyncResult(fn(result.error));
        }

        if (result.isOk()) {
          return ok(result.value);
        }

        throw new Error('Unreachable result branch');
      }),
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

      throw new Error('Unreachable result branch');
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

  andThrough<F>(
    fn: (value: T) => AsyncResultInput<unknown, F>,
  ): ResultAsync<T, E | F> {
    return new ResultAsync(
      this.promise.then(async (result) => {
        if (result.isOk()) {
          const next = await resolveAsyncResult(fn(result.value));
          return next.isErr() ? err<E | F>(next.error) : ok(result.value);
        }

        if (result.isErr()) {
          return err<E | F>(result.error);
        }

        throw new Error('Unreachable result branch');
      }),
    );
  }

  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
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
    { [K in keyof TResults]: AsyncOkValue<TResults[K]> },
    AsyncErrValue<TResults[number]>
  >;
  static combine<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E>;
  static combine<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E> {
    return new ResultAsync(
      Promise.all(results.map((result) => Promise.resolve(result))).then(
        (resolved) => Result.combine(resolved),
      ),
    );
  }

  static combineWithAllErrors<
    const TResults extends readonly PromiseLike<Result<unknown, unknown>>[],
  >(
    results: TResults,
  ): ResultAsync<
    { [K in keyof TResults]: AsyncOkValue<TResults[K]> },
    AsyncErrValue<TResults[number]>[]
  >;
  static combineWithAllErrors<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E[]>;
  static combineWithAllErrors<T, E>(
    results: readonly PromiseLike<Result<T, E>>[],
  ): ResultAsync<T[], E[]> {
    return new ResultAsync(
      Promise.all(results.map((result) => Promise.resolve(result))).then(
        (resolved) => Result.combineWithAllErrors(resolved),
      ),
    );
  }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value);

export const err = <E>(error: E): Err<E> => new Err(error);

export const fail = <TType extends string>(
  error: TypedError<TType>,
): Err<TypedError<TType>> => err(error);

export const okAsync = <T>(value: T): ResultAsync<T, never> =>
  new ResultAsync(Promise.resolve(ok(value)));

export const errAsync = <E>(error: E): ResultAsync<never, E> =>
  new ResultAsync(Promise.resolve(err(error)));
