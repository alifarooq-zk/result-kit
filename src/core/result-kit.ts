import {
  isTypedError,
  type TypedError,
} from './error';
import {
  type Failure,
  type Result,
  type Success,
} from './result';

export abstract class ResultKit {
  static isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
    return result.ok === true;
  }

  static isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
    return result.ok === false;
  }

  static success<T>(value: T): Success<T> {
    return { ok: true, value };
  }

  static failure<E>(error: E): Failure<E> {
    return { ok: false, error };
  }

  static fail<T extends string>(error: TypedError<T>): Failure<TypedError<T>> {
    return this.failure(error);
  }

  static isTypedError(error: unknown): error is TypedError<string> {
    return isTypedError(error);
  }

  static map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return this.isSuccess(result) ? this.success(fn(result.value)) : result;
  }

  static bimap<T, U, E, F>(
    result: Result<T, E>,
    onSuccess: (value: T) => U,
    onFailure: (error: E) => F,
  ): Result<U, F> {
    return this.isSuccess(result)
      ? this.success(onSuccess(result.value))
      : this.failure(onFailure(result.error));
  }

  static async mapAsync<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<U>,
  ): Promise<Result<U, E>> {
    return this.isSuccess(result)
      ? this.success(await fn(result.value))
      : result;
  }

  static mapError<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F,
  ): Result<T, F> {
    return this.isFailure(result) ? this.failure(fn(result.error)) : result;
  }

  static async mapErrorAsync<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => Promise<F>,
  ): Promise<Result<T, F>> {
    return this.isFailure(result)
      ? this.failure(await fn(result.error))
      : result;
  }

  static andThen<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>,
  ): Result<U, E> {
    return this.isSuccess(result) ? fn(result.value) : result;
  }

  static async andThenAsync<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>,
  ): Promise<Result<U, E>> {
    return this.isSuccess(result) ? fn(result.value) : result;
  }

  static orElse<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => Result<T, F>,
  ): Result<T, F> {
    return this.isFailure(result) ? fn(result.error) : result;
  }

  static async orElseAsync<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => Promise<Result<T, F>>,
  ): Promise<Result<T, F>> {
    return this.isFailure(result) ? fn(result.error) : result;
  }

  static unwrap<T, E>(result: Result<T, E>): T | undefined {
    return this.isSuccess(result) ? result.value : undefined;
  }

  static unwrapSuccess<T>(result: Success<T>): T {
    return result.value;
  }

  static unwrapFailure<E>(result: Failure<E>): E {
    return result.error;
  }

  static unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return this.isSuccess(result) ? result.value : defaultValue;
  }

  static unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
    return this.isSuccess(result) ? result.value : fn(result.error);
  }

  static async unwrapOrElseAsync<T, E>(
    result: Result<T, E>,
    fn: (error: E) => Promise<T>,
  ): Promise<T> {
    return this.isSuccess(result) ? result.value : fn(result.error);
  }

  static match<T, E, U>(
    result: Result<T, E>,
    handlers: {
      onSuccess: (value: T) => U;
      onFailure: (error: E) => U;
    },
  ): U {
    return this.isSuccess(result)
      ? handlers.onSuccess(result.value)
      : handlers.onFailure(result.error);
  }

  static async matchAsync<T, E, U>(
    result: Result<T, E>,
    handlers: {
      onSuccess: (value: T) => Promise<U>;
      onFailure: (error: E) => Promise<U>;
    },
  ): Promise<U> {
    return this.isSuccess(result)
      ? handlers.onSuccess(result.value)
      : handlers.onFailure(result.error);
  }

  static tap<T, E>(
    result: Result<T, E>,
    handlers: {
      onSuccess?: (value: T) => void;
      onFailure?: (error: E) => void;
    },
  ): Result<T, E> {
    if (this.isSuccess(result)) {
      handlers.onSuccess?.(result.value);
    } else {
      handlers.onFailure?.(result.error);
    }

    return result;
  }

  static async tapAsync<T, E>(
    result: Result<T, E>,
    handlers: {
      onSuccess?: (value: T) => Promise<void>;
      onFailure?: (error: E) => Promise<void>;
    },
  ): Promise<Result<T, E>> {
    if (this.isSuccess(result)) {
      await handlers.onSuccess?.(result.value);
    } else {
      await handlers.onFailure?.(result.error);
    }

    return result;
  }

  static combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
      if (this.isFailure(result)) {
        return result;
      }

      values.push(result.value);
    }

    return this.success(values);
  }

  static async combineAsync<T, E>(
    results: Promise<Result<T, E>>[],
  ): Promise<Result<T[], E>> {
    return this.combine(await Promise.all(results));
  }

  static combineWithAllErrors<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
    const values: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
      if (this.isSuccess(result)) {
        values.push(result.value);
      } else {
        errors.push(result.error);
      }
    }

    return errors.length > 0 ? this.failure(errors) : this.success(values);
  }

  static async combineWithAllErrorsAsync<T, E>(
    results: Promise<Result<T, E>>[],
  ): Promise<Result<T[], E[]>> {
    return this.combineWithAllErrors(await Promise.all(results));
  }

  static flatten<T, E>(result: Result<Result<T, E>, E>): Result<T, E> {
    return this.isSuccess(result) ? result.value : result;
  }

  static async fromPromise<T, E>(
    promise: Promise<T>,
    errorFn: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      return this.success(await promise);
    } catch (error) {
      return this.failure(errorFn(error));
    }
  }

  static fromThrowable<Args extends unknown[], T, E>(
    fn: (...args: Args) => T,
    errorFn: (error: unknown) => E,
  ): (...args: Args) => Result<T, E> {
    return (...args) => {
      try {
        return this.success(fn(...args));
      } catch (error) {
        return this.failure(errorFn(error));
      }
    };
  }

  static fromThrowableAsync<Args extends unknown[], T, E>(
    fn: (...args: Args) => Promise<T>,
    errorFn: (error: unknown) => E,
  ): (...args: Args) => Promise<Result<T, E>> {
    return async (...args) => {
      try {
        return this.success(await fn(...args));
      } catch (error) {
        return this.failure(errorFn(error));
      }
    };
  }

  static fromNullable<T, E>(
    value: T | null | undefined,
    error: E,
  ): Result<NonNullable<T>, E> {
    return value == null ? this.failure(error) : this.success(value);
  }

  static fromPredicate<T, E>(
    value: T,
    predicate: (value: T) => boolean,
    error: E,
  ): Result<T, E> {
    return predicate(value) ? this.success(value) : this.failure(error);
  }

  static toNullable<T, E>(result: Result<T, E>): T | null {
    return this.isSuccess(result) ? result.value : null;
  }

  static partition<T, E>(results: Result<T, E>[]): [T[], E[]] {
    const values: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
      if (this.isSuccess(result)) {
        values.push(result.value);
      } else {
        errors.push(result.error);
      }
    }

    return [values, errors];
  }

  static filterSuccesses<T, E>(results: Result<T, E>[]): T[] {
    return results
      .filter((result): result is Success<T> => this.isSuccess(result))
      .map((result) => result.value);
  }

  static filterFailures<T, E>(results: Result<T, E>[]): E[] {
    return results
      .filter((result): result is Failure<E> => this.isFailure(result))
      .map((result) => result.error);
  }
}
