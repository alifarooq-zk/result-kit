import type { TypedError } from "./error";

/**
 * Public result shape used throughout the package.
 *
 * `Result<T, E>` is a discriminated union over {@link Ok} and {@link Err},
 * which allows TypeScript to narrow directly on `result.ok`.
 *
 * @typeParam T Success value type.
 * @typeParam E Failure value type.
 * @example
 * ```ts
 * const result: Result<number, string> =
 *   Math.random() > 0.5 ? ok(42) : err("boom");
 *
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.log(result.error);
 * }
 * ```
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Internal helper describing every accepted sync or async result source.
 *
 * This keeps the chaining methods flexible while centralizing the accepted
 * shapes in one place.
 *
 * @typeParam T Success value type.
 * @typeParam E Failure value type.
 * @example
 * ```ts
 * type Input = ResultSource<string, Error>;
 * // Result<string, Error> | PromiseLike<Result<string, Error>> | ResultAsync<string, Error>
 * ```
 */
type ResultSource<T, E> =
  | Result<T, E>
  | PromiseLike<Result<T, E>>
  | ResultAsync<T, E>;

/**
 * Resolves a {@link ResultSource} down to its underlying {@link Result}
 * shape for internal type inference.
 *
 * @typeParam TValue Async result source to inspect.
 * @example
 * ```ts
 * type Resolved = ResolvedResult<Promise<Result<string, number>>>;
 * // Result<string, number>
 * ```
 */
type ResolvedResult<TValue extends ResultSource<unknown, unknown>> =
  Awaited<TValue> extends Result<unknown, unknown> ? Awaited<TValue> : never;

/**
 * Extracts the success value type from an internal async result source.
 *
 * @typeParam TValue Async result source to inspect.
 * @example
 * ```ts
 * type Value = ResolvedValue<ResultAsync<{ id: string }, Error>>;
 * // { id: string }
 * ```
 */
type ResolvedValue<TValue extends ResultSource<unknown, unknown>> =
  ResultValue<ResolvedResult<TValue>>;

/**
 * Extracts the failure type from an internal async result source.
 *
 * @typeParam TValue Async result source to inspect.
 * @example
 * ```ts
 * type Failure = ResolvedError<Promise<Result<string, Error>>>;
 * // Error
 * ```
 */
type ResolvedError<TValue extends ResultSource<unknown, unknown>> =
  ResultError<ResolvedResult<TValue>>;

/**
 * Extracts the success value type from a {@link Result}.
 *
 * @typeParam TValue Result type to inspect.
 * @example
 * ```ts
 * type UserResult = Result<{ id: string }, "not_found">;
 * type User = ResultValue<UserResult>;
 * //    ^? { id: string }
 * ```
 */
export type ResultValue<TValue extends Result<unknown, unknown>> =
  TValue extends Ok<infer T> ? T : never;

/**
 * Extracts the failure type from a {@link Result}.
 *
 * @typeParam TValue Result type to inspect.
 * @example
 * ```ts
 * type UserResult = Result<{ id: string }, "not_found">;
 * type UserError = ResultError<UserResult>;
 * //    ^? "not_found"
 * ```
 */
export type ResultError<TValue extends Result<unknown, unknown>> =
  TValue extends Err<infer E> ? E : never;

/**
 * Extracts the success branch from a {@link Result}.
 *
 * @typeParam TValue Result type to inspect.
 * @example
 * ```ts
 * type SuccessBranch = ResultOk<Result<string, number>>;
 * //    ^? Ok<string>
 * ```
 */
export type ResultOk<TValue extends Result<unknown, unknown>> =
  TValue extends Ok<infer T> ? Ok<T> : never;

/**
 * Extracts the failure branch from a {@link Result}.
 *
 * @typeParam TValue Result type to inspect.
 * @example
 * ```ts
 * type FailureBranch = ResultErr<Result<string, number>>;
 * //    ^? Err<number>
 * ```
 */
export type ResultErr<TValue extends Result<unknown, unknown>> =
  TValue extends Err<infer E> ? Err<E> : never;

/**
 * Extracts the success value type from an async result source.
 *
 * @typeParam TValue Promise-like result source to inspect.
 * @example
 * ```ts
 * type Payload = AsyncResultValue<Promise<Result<{ id: string }, Error>>>;
 * //    ^? { id: string }
 * ```
 */
export type AsyncResultValue<TValue extends PromiseLike<Result<unknown, unknown>>> =
  Awaited<TValue> extends Result<unknown, unknown>
    ? ResultValue<Awaited<TValue>>
    : never;

/**
 * Extracts the failure type from an async result source.
 *
 * @typeParam TValue Promise-like result source to inspect.
 * @example
 * ```ts
 * type Failure = AsyncResultError<Promise<Result<{ id: string }, Error>>>;
 * //    ^? Error
 * ```
 */
export type AsyncResultError<TValue extends PromiseLike<Result<unknown, unknown>>> =
  Awaited<TValue> extends Result<unknown, unknown>
    ? ResultError<Awaited<TValue>>
    : never;

/**
 * Normalizes any accepted async result source into a concrete promise of
 * {@link Result}.
 *
 * @param input Sync result, async result, or promise-like result source.
 * @returns A promise that resolves to a {@link Result}.
 * @example
 * ```ts
 * const normalized = resolveResultSource(Promise.resolve(ok("ready")));
 * ```
 */
const resolveResultSource = <T, E>(
  input: ResultSource<T, E>,
): Promise<Result<T, E>> => Promise.resolve(input);

/**
 * Shared implementation for fluent sync result behavior.
 *
 * The public API narrows through {@link Ok} and {@link Err}, while this base
 * class centralizes the shared method implementations so the runtime logic does
 * not diverge between branches.
 *
 * @typeParam T Success value type.
 * @typeParam E Failure value type.
 */
abstract class ResultBase<T, E> {
  /**
   * Discriminant used for runtime branching and TypeScript narrowing.
   */
  abstract readonly ok: boolean;

  /**
   * Determines whether this result is successful.
   *
   * @returns `true` when the current result is an {@link Ok}.
   * @example
   * ```ts
   * const result = ok("token");
   *
   * if (result.isOk()) {
   *   console.log(result.value);
   * }
   * ```
   */
  isOk(): this is Ok<T> {
    return this.ok;
  }

  /**
   * Determines whether this result is failed.
   *
   * @returns `true` when the current result is an {@link Err}.
   * @example
   * ```ts
   * const result = err("boom");
   *
   * if (result.isErr()) {
   *   console.log(result.error);
   * }
   * ```
   */
  isErr(): this is Err<E> {
    return !this.ok;
  }

  /**
   * Maps a successful value while preserving failures unchanged.
   *
   * @param fn Mapper applied only when the result is successful.
   * @returns A new result containing the mapped success value or the original
   * failure.
   * @example
   * ```ts
   * const result = ok(2).map((value) => value * 3);
   * // Ok(6)
   * ```
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isOk()) {
      return ok(fn(this.value));
    }

    if (this.isErr()) {
      return err(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Maps a failure value while preserving successful values unchanged.
   *
   * @param fn Mapper applied only when the result is failed.
   * @returns A new result containing the mapped failure value or the original
   * success.
   * @example
   * ```ts
   * const result = err("timeout").mapErr((message) => new Error(message));
   * ```
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isErr()) {
      return err(fn(this.error));
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Chains another result-producing step after a successful value.
   *
   * @param fn Callback invoked only when the result is successful.
   * @returns The next result when successful, or the original failure.
   * @example
   * ```ts
   * const parseId = (value: string) =>
   *   /^\d+$/.test(value) ? ok(Number(value)) : err("invalid_id");
   *
   * const result = ok("42").andThen(parseId);
   * ```
   */
  andThen<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): Result<ResultValue<TNext>, E | ResultError<TNext>> {
    if (this.isOk()) {
      return fn(this.value) as Result<ResultValue<TNext>, E | ResultError<TNext>>;
    }

    if (this.isErr()) {
      return err<E | ResultError<TNext>>(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Recovers from a failure by mapping it into another result.
   *
   * @param fn Callback invoked only when the result is failed.
   * @returns The original success or the recovery result.
   * @example
   * ```ts
   * const result = err("missing_name").orElse(() => ok("anonymous"));
   * ```
   */
  orElse<TNext extends Result<unknown, unknown>>(
    fn: (error: E) => TNext,
  ): Result<T | ResultValue<TNext>, ResultError<TNext>> {
    if (this.isErr()) {
      return fn(this.error) as Result<T | ResultValue<TNext>, ResultError<TNext>>;
    }

    if (this.isOk()) {
      return ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Exhaustively matches both result branches.
   *
   * @param onOk Handler for the success branch.
   * @param onErr Handler for the failure branch.
   * @returns The value returned by the matching handler.
   * @example
   * ```ts
   * const label = ok(42).match(
   *   (value) => `value:${value}`,
   *   (error) => `error:${error}`,
   * );
   * ```
   */
  match<A, B>(onOk: (value: T) => A, onErr: (error: E) => B): A | B {
    if (this.isOk()) {
      return onOk(this.value);
    }

    if (this.isErr()) {
      return onErr(this.error);
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Unwraps a successful value or returns a provided fallback.
   *
   * @param defaultValue Fallback returned when the result is failed.
   * @returns The success value or `defaultValue`.
   * @example
   * ```ts
   * const id = err("missing").unwrapOr("guest");
   * ```
   */
  unwrapOr<TDefault>(defaultValue: TDefault): T | TDefault {
    if (this.isOk()) {
      return this.value;
    }

    return defaultValue;
  }

  /**
   * Unwraps a successful value or computes a fallback from the failure.
   *
   * @param fn Fallback factory invoked when the result is failed.
   * @returns The success value or the computed fallback.
   * @example
   * ```ts
   * const label = err("missing").unwrapOrElse((error) => error.toUpperCase());
   * ```
   */
  unwrapOrElse<TDefault>(fn: (error: E) => TDefault): T | TDefault {
    if (this.isErr()) {
      return fn(this.error);
    }

    if (this.isOk()) {
      return this.value;
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Maps a successful value into an async success while preserving failures.
   *
   * @param fn Async mapper applied only when the result is successful.
   * @returns A {@link ResultAsync} containing the mapped value or original
   * failure.
   * @example
   * ```ts
   * const result = ok("42").asyncMap(async (value) => Number(value));
   * ```
   */
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

  /**
   * Chains a sync or async result-producing step after a successful value.
   *
   * @param fn Callback invoked only when the result is successful.
   * @returns A {@link ResultAsync} containing the next success or the widened
   * failure union.
   * @example
   * ```ts
   * const findUser = async (id: string) => ok({ id });
   *
   * const result = ok("u_123").asyncAndThen(findUser);
   * ```
   */
  asyncAndThen<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<ResultValue<TNext>, E | ResultError<TNext>>;
  asyncAndThen<U, F>(
    fn: (value: T) => ResultAsync<U, F>,
  ): ResultAsync<U, E | F>;
  asyncAndThen<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => PromiseLike<TNext>,
  ): ResultAsync<ResultValue<TNext>, E | ResultError<TNext>>;
  asyncAndThen<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<ResolvedValue<TSource>, E | ResolvedError<TSource>>;
  asyncAndThen<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<ResolvedValue<TSource>, E | ResolvedError<TSource>> {
    if (this.isErr()) {
      return new ResultAsync(
        Promise.resolve(err<E | ResolvedError<TSource>>(this.error)),
      );
    }

    if (this.isOk()) {
      return new ResultAsync(
        resolveResultSource(fn(this.value)) as Promise<
          Result<ResolvedValue<TSource>, E | ResolvedError<TSource>>
        >,
      );
    }

    throw new Error("Unreachable result branch");
  }

  /**
   * Runs an observational callback for successful values without changing the
   * main result.
   *
   * Errors thrown by the callback are ignored.
   *
   * @param fn Side-effect callback invoked only for successful values.
   * @returns The original result instance.
   * @example
   * ```ts
   * const result = ok("user").andTee((value) => console.log(value));
   * ```
   */
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

  /**
   * Runs an observational callback for failures without changing the main
   * result.
   *
   * Errors thrown by the callback are ignored.
   *
   * @param fn Side-effect callback invoked only for failures.
   * @returns The original result instance.
   * @example
   * ```ts
   * const result = err("boom").orTee((error) => console.error(error));
   * ```
   */
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

  /**
   * Validates a successful value through another result-producing step while
   * preserving the original success payload.
   *
   * @param fn Validation step invoked only for successful values.
   * @returns The original success value when validation succeeds, or the first
   * failure encountered.
   * @example
   * ```ts
   * const result = ok("secret").andThrough((value) =>
   *   value.length > 3 ? ok(value.length) : err("too_short"),
   * );
   * ```
   */
  andThrough<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): Result<T, E | ResultError<TNext>> {
    if (this.isErr()) {
      return err<E | ResultError<TNext>>(this.error);
    }

    if (this.isOk()) {
      const next = fn(this.value);
      return next.isErr()
        ? err<E | ResultError<TNext>>(next.error as ResultError<TNext>)
        : ok(this.value);
    }

    throw new Error("Unreachable result branch");
  }
}

/**
 * Successful result variant.
 *
 * @typeParam T Success value type.
 * @example
 * ```ts
 * const result = new Ok({ id: "u_123" });
 * ```
 */
export class Ok<T> extends ResultBase<T, never> {
  readonly ok = true as const;

  /**
   * Creates a successful result.
   *
   * @param value Value to store in the success branch.
   * @example
   * ```ts
   * const result = new Ok("ready");
   * ```
   */
  constructor(readonly value: T) {
    super();
  }
}

/**
 * Failed result variant.
 *
 * @typeParam E Failure value type.
 * @example
 * ```ts
 * const result = new Err("not_found");
 * ```
 */
export class Err<E> extends ResultBase<never, E> {
  readonly ok = false as const;

  /**
   * Creates a failed result.
   *
   * @param error Failure payload to store.
   * @example
   * ```ts
   * const result = new Err({ type: "not_found", message: "User missing" });
   * ```
   */
  constructor(readonly error: E) {
    super();
  }
}

/**
 * Creates a successful result.
 *
 * @param value Value to wrap in an {@link Ok}.
 * @returns An {@link Ok} containing `value`.
 * @example
 * ```ts
 * const result = ok({ id: "u_123" });
 * ```
 */
export const ok = <T>(value: T): Ok<T> => new Ok(value);

/**
 * Creates a failed result with an arbitrary error payload.
 *
 * @param error Failure payload to wrap in an {@link Err}.
 * @returns An {@link Err} containing `error`.
 * @example
 * ```ts
 * const result = err("timeout");
 * ```
 */
export const err = <E>(error: E): Err<E> => new Err(error);

/**
 * Creates a failed result from a {@link TypedError} while preserving any
 * richer subtype information.
 *
 * @param error Structured typed error payload.
 * @returns An {@link Err} containing the exact typed error subtype.
 * @example
 * ```ts
 * const result = fail({
 *   type: "validation_error",
 *   message: "Email is invalid",
 *   details: { field: "email" },
 * });
 * ```
 */
export const fail = <TError extends TypedError<string, any>>(
  error: TError,
): Err<TError> => err(error);

/**
 * Creates an async successful result from a raw value.
 *
 * @param value Value to resolve as successful.
 * @returns A {@link ResultAsync} that resolves to {@link Ok}.
 * @example
 * ```ts
 * const result = okAsync("ready");
 * ```
 */
export const okAsync = <T>(value: T): ResultAsync<T, never> =>
  new ResultAsync(Promise.resolve(ok(value)));

/**
 * Creates an async failed result from a raw error value.
 *
 * @param error Failure payload to resolve as failed.
 * @returns A {@link ResultAsync} that resolves to {@link Err}.
 * @example
 * ```ts
 * const result = errAsync("timeout");
 * ```
 */
export const errAsync = <E>(error: E): ResultAsync<never, E> =>
  new ResultAsync(Promise.resolve(err(error)));

/**
 * Wraps a throwable function so it returns a {@link Result} instead of
 * throwing.
 *
 * @param fn Function that may throw.
 * @param errorFn Mapper used to convert the thrown value into the failure type.
 * @returns A new function that returns {@link Ok} on success and {@link Err}
 * when `fn` throws.
 * @example
 * ```ts
 * const parseJson = Result.fromThrowable(JSON.parse, () => "invalid_json");
 *
 * const result = parseJson('{"ok":true}');
 * ```
 */
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

/**
 * Converts a nullable value into a {@link Result}.
 *
 * @param value Value that may be `null` or `undefined`.
 * @param error Failure payload to use when the value is nullish.
 * @returns {@link Ok} with the non-null value, or {@link Err} with `error`.
 * @example
 * ```ts
 * const result = Result.fromNullable(process.env.API_KEY, "missing_api_key");
 * ```
 */
function fromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<NonNullable<T>, E> {
  return value == null ? err(error) : ok(value);
}

/**
 * Converts a value into a {@link Result} by checking a predicate.
 *
 * @param value Value to validate.
 * @param predicate Predicate used to decide whether the value is acceptable.
 * @param error Failure payload to use when the predicate returns `false`.
 * @returns {@link Ok} when the predicate passes, otherwise {@link Err}.
 * @example
 * ```ts
 * const result = Result.fromPredicate(4, (value) => value > 2, "too_small");
 * ```
 * @example
 * ```ts
 * const mixed: string | number = "42";
 *
 * const result = Result.fromPredicate(
 *   mixed,
 *   (value): value is string => typeof value === "string",
 *   "not_a_string",
 * );
 * ```
 */
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

/**
 * Combines multiple results into one, failing fast on the first error.
 *
 * @param results Results to combine.
 * @returns {@link Ok} with an array or tuple of success values, or the first
 * {@link Err} encountered.
 * @example
 * ```ts
 * const result = Result.combine([ok("a"), ok("b")]);
 * ```
 * @example
 * ```ts
 * const tuple = Result.combine([ok("id"), ok(42)] as const);
 * // Result<[string, number], never>
 * ```
 */
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

/**
 * Combines multiple results while collecting every failure.
 *
 * @param results Results to combine.
 * @returns {@link Ok} with all success values when every result succeeds, or
 * {@link Err} containing all collected failures.
 * @example
 * ```ts
 * const result = Result.combineWithAllErrors([
 *   ok(1),
 *   err("missing_name"),
 *   err("missing_email"),
 * ]);
 * ```
 */
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

/**
 * Static helper namespace that exposes non-instance result constructors and
 * combinators.
 *
 * @example
 * ```ts
 * const parseJson = Result.fromThrowable(JSON.parse, () => "invalid_json");
 * const value = Result.fromNullable("ready", "missing");
 * ```
 */
export interface ResultStatic {
  /**
   * Wraps a throwable function so it returns a {@link Result}.
   */
  readonly fromThrowable: typeof fromThrowable;
  /**
   * Converts a nullable value into a {@link Result}.
   */
  readonly fromNullable: typeof fromNullable;
  /**
   * Converts a value into a {@link Result} by checking a predicate.
   */
  readonly fromPredicate: typeof fromPredicate;
  /**
   * Combines multiple results and stops on the first failure.
   */
  readonly combine: typeof combine;
  /**
   * Combines multiple results and collects every failure.
   */
  readonly combineWithAllErrors: typeof combineWithAllErrors;
}

/**
 * Static helper namespace for top-level result constructors and combinators.
 *
 * @example
 * ```ts
 * const result = Result.fromNullable(process.env.API_KEY, "missing_api_key");
 * ```
 */
export const Result: ResultStatic = {
  fromThrowable,
  fromNullable,
  fromPredicate,
  combine,
  combineWithAllErrors,
};

/**
 * Promise-like wrapper for composing async result flows.
 *
 * @typeParam T Success value type.
 * @typeParam E Failure value type.
 * @example
 * ```ts
 * const fetchUser = ResultAsync.fromPromise(fetch("/users/1"), () => "network");
 * ```
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  /**
   * Creates a new async result wrapper.
   *
   * @param promise Promise resolving to a {@link Result}.
   * @example
   * ```ts
   * const result = new ResultAsync(Promise.resolve(ok("ready")));
   * ```
   */
  constructor(private readonly promise: Promise<Result<T, E>>) {}

  /**
   * Maps a successful async value while preserving failures.
   *
   * @param fn Sync or async mapper applied only to successful values.
   * @returns A new {@link ResultAsync} with the mapped success value.
   * @example
   * ```ts
   * const result = okAsync(2).map(async (value) => value * 3);
   * ```
   */
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

  /**
   * Maps an async failure while preserving successful values.
   *
   * @param fn Sync or async mapper applied only to failures.
   * @returns A new {@link ResultAsync} with the mapped failure value.
   * @example
   * ```ts
   * const result = errAsync("timeout").mapErr((error) => new Error(error));
   * ```
   */
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

  /**
   * Chains another sync or async result-producing step after success.
   *
   * @param fn Callback invoked only for successful values.
   * @returns A new {@link ResultAsync} with the next success or widened failure
   * union.
   * @example
   * ```ts
   * const result = okAsync("u_123").andThen(async (id) => ok({ id }));
   * ```
   */
  andThen<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<ResultValue<TNext>, E | ResultError<TNext>>;
  andThen<U, F>(fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F>;
  andThen<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => PromiseLike<TNext>,
  ): ResultAsync<ResultValue<TNext>, E | ResultError<TNext>>;
  andThen<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<ResolvedValue<TSource>, E | ResolvedError<TSource>>;
  andThen<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<ResolvedValue<TSource>, E | ResolvedError<TSource>> {
    return new ResultAsync(
      this.promise.then(
        async (
          result,
        ): Promise<Result<ResolvedValue<TSource>, E | ResolvedError<TSource>>> => {
          if (result.isOk()) {
            return resolveResultSource(fn(result.value)) as Promise<
              Result<ResolvedValue<TSource>, E | ResolvedError<TSource>>
            >;
          }

          if (result.isErr()) {
            return err<E | ResolvedError<TSource>>(result.error);
          }

          throw new Error("Unreachable result branch");
        },
      ),
    );
  }

  /**
   * Recovers from an async failure by mapping it into another result source.
   *
   * @param fn Callback invoked only for failed values.
   * @returns A new {@link ResultAsync} with the recovery result.
   * @example
   * ```ts
   * const result = errAsync("missing_name").orElse(() => ok("anonymous"));
   * ```
   */
  orElse<TNext extends Result<unknown, unknown>>(
    fn: (error: E) => TNext,
  ): ResultAsync<T | ResultValue<TNext>, ResultError<TNext>>;
  orElse<U, F>(fn: (error: E) => ResultAsync<U, F>): ResultAsync<T | U, F>;
  orElse<TNext extends Result<unknown, unknown>>(
    fn: (error: E) => PromiseLike<TNext>,
  ): ResultAsync<T | ResultValue<TNext>, ResultError<TNext>>;
  orElse<TSource extends ResultSource<unknown, unknown>>(
    fn: (error: E) => TSource,
  ): ResultAsync<T | ResolvedValue<TSource>, ResolvedError<TSource>>;
  orElse<TSource extends ResultSource<unknown, unknown>>(
    fn: (error: E) => TSource,
  ): ResultAsync<T | ResolvedValue<TSource>, ResolvedError<TSource>> {
    return new ResultAsync(
      this.promise.then(
        async (
          result,
        ): Promise<Result<T | ResolvedValue<TSource>, ResolvedError<TSource>>> => {
          if (result.isErr()) {
            return resolveResultSource(fn(result.error)) as Promise<
              Result<T | ResolvedValue<TSource>, ResolvedError<TSource>>
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

  /**
   * Exhaustively matches the resolved result branches.
   *
   * @param onOk Handler for the success branch.
   * @param onErr Handler for the failure branch.
   * @returns A promise resolving to the matching handler's return value.
   * @example
   * ```ts
   * const label = await okAsync(42).match(
   *   (value) => `value:${value}`,
   *   (error) => `error:${error}`,
   * );
   * ```
   */
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

  /**
   * Awaits the result and unwraps the success value or returns a fallback.
   *
   * @param defaultValue Fallback returned when the async result fails.
   * @returns A promise resolving to the success value or `defaultValue`.
   * @example
   * ```ts
   * const user = await errAsync("missing_user").unwrapOr({ id: "guest" });
   * ```
   */
  unwrapOr<TDefault>(defaultValue: TDefault): Promise<T | TDefault> {
    return this.promise.then((result) => result.unwrapOr(defaultValue));
  }

  /**
   * Runs an observational async callback for successful values.
   *
   * Errors thrown by the callback are ignored.
   *
   * @param fn Side-effect callback invoked only for successful values.
   * @returns The original {@link ResultAsync}.
   * @example
   * ```ts
   * const result = okAsync("user").andTee(async (value) => console.log(value));
   * ```
   */
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

  /**
   * Runs an observational async callback for failures.
   *
   * Errors thrown by the callback are ignored.
   *
   * @param fn Side-effect callback invoked only for failures.
   * @returns The original {@link ResultAsync}.
   * @example
   * ```ts
   * const result = errAsync("boom").orTee(async (error) => console.error(error));
   * ```
   */
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

  /**
   * Validates a successful async value through another result source while
   * preserving the original success payload.
   *
   * @param fn Validation step invoked only for successful values.
   * @returns A new {@link ResultAsync} containing the original success or the
   * first failure encountered.
   * @example
   * ```ts
   * const result = okAsync("token").andThrough(async (token) =>
   *   token.length > 3 ? ok(token.length) : err("too_short"),
   * );
   * ```
   */
  andThrough<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => TNext,
  ): ResultAsync<T, E | ResultError<TNext>>;
  andThrough<U, F>(fn: (value: T) => ResultAsync<U, F>): ResultAsync<T, E | F>;
  andThrough<TNext extends Result<unknown, unknown>>(
    fn: (value: T) => PromiseLike<TNext>,
  ): ResultAsync<T, E | ResultError<TNext>>;
  andThrough<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<T, E | ResolvedError<TSource>>;
  andThrough<TSource extends ResultSource<unknown, unknown>>(
    fn: (value: T) => TSource,
  ): ResultAsync<T, E | ResolvedError<TSource>> {
    return new ResultAsync(
      this.promise.then(async (result) => {
        if (result.isOk()) {
          const next = (await resolveResultSource(
            fn(result.value),
          )) as ResolvedResult<TSource>;
          if (next.isErr()) {
            return err<E | ResolvedError<TSource>>(
              next.error as ResolvedError<TSource>,
            );
          }

          return ok(result.value);
        }

        if (result.isErr()) {
          return err<E | ResolvedError<TSource>>(result.error);
        }

        throw new Error("Unreachable result branch");
      }),
    );
  }

  /**
   * Makes {@link ResultAsync} awaitable like a promise.
   *
   * @param onfulfilled Optional fulfillment handler.
   * @param onrejected Optional rejection handler.
   * @returns A promise-like value that resolves from the wrapped result.
   * @example
   * ```ts
   * const result = await okAsync("ready");
   * ```
   */
  then<TResult1 = Result<T, E>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.promise.then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  /**
   * Converts an arbitrary promise into a {@link ResultAsync}.
   *
   * @param promise Promise for the success value.
   * @param errorFn Mapper used to convert rejected values into the failure type.
   * @returns A {@link ResultAsync} resolving to {@link Ok} or {@link Err}.
   * @example
   * ```ts
   * const result = ResultAsync.fromPromise(fetch("/users/1"), () => "network");
   * ```
   */
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

  /**
   * Wraps an async throwable function so it returns a {@link ResultAsync}.
   *
   * @param fn Async function that may throw or reject.
   * @param errorFn Mapper used to convert thrown values into the failure type.
   * @returns A new function returning {@link ResultAsync}.
   * @example
   * ```ts
   * const parseJson = ResultAsync.fromThrowable(
   *   async (input: string) => JSON.parse(input),
   *   () => "invalid_json",
   * );
   * ```
   */
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

  /**
   * Combines multiple async results and stops on the first failure.
   *
   * @param results Async results to combine.
   * @returns A {@link ResultAsync} containing all success values or the first
   * failure.
   * @example
   * ```ts
   * const result = ResultAsync.combine([
   *   Promise.resolve(ok("a")),
   *   Promise.resolve(ok("b")),
   * ]);
   * ```
   */
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

  /**
   * Combines multiple async results while collecting every failure.
   *
   * @param results Async results to combine.
   * @returns A {@link ResultAsync} containing all success values or all
   * collected failures.
   * @example
   * ```ts
   * const result = ResultAsync.combineWithAllErrors([
   *   Promise.resolve(err("missing_name")),
   *   Promise.resolve(err("missing_email")),
   * ]);
   * ```
   */
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
