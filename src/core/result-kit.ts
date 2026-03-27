import {
  Result,
  ResultAsync,
  err,
  errAsync,
  fail,
  ok,
  okAsync,
} from './result';

/**
 * Branded static facade over the fluent result API.
 *
 * `ResultKit` exists as a package-level entrypoint only. Fluent result
 * behavior lives on `Ok`, `Err`, and `ResultAsync`, while `Result` exposes the
 * static-style helper namespace.
 *
 * @example
 * ```ts
 * const result = ResultKit
 *   .ok("u_123")
 *   .andThen((id) => ResultKit.ok({ id }));
 * ```
 */
export abstract class ResultKit {
  /**
   * Creates a successful result.
   *
   * @example
   * ```ts
   * const result = ResultKit.ok("ready");
   * ```
   */
  static ok = ok;

  /**
   * Creates a failed result from a typed error payload.
   *
   * @example
   * ```ts
   * const result = ResultKit.fail({
   *   type: "validation_error",
   *   message: "Email is invalid",
   * });
   * ```
   */
  static fail = fail;

  /**
   * Creates a failed result from an arbitrary error payload.
   *
   * @example
   * ```ts
   * const result = ResultKit.err("timeout");
   * ```
   */
  static err = err;

  /**
   * Creates an async successful result.
   *
   * @example
   * ```ts
   * const result = ResultKit.okAsync("ready");
   * ```
   */
  static okAsync = okAsync;

  /**
   * Creates an async failed result.
   *
   * @example
   * ```ts
   * const result = ResultKit.errAsync("timeout");
   * ```
   */
  static errAsync = errAsync;

  /**
   * Wraps a throwable function so it returns a result.
   */
  static fromThrowable = Result.fromThrowable;

  /**
   * Converts a nullable value into a result.
   */
  static fromNullable = Result.fromNullable;

  /**
   * Converts a value into a result by checking a predicate.
   */
  static fromPredicate = Result.fromPredicate;

  /**
   * Combines multiple results and stops on the first failure.
   */
  static combine = Result.combine;

  /**
   * Combines multiple results and collects every failure.
   */
  static combineWithAllErrors = Result.combineWithAllErrors;

  /**
   * Converts a promise into an async result.
   */
  static fromPromise = ResultAsync.fromPromise;

  /**
   * Wraps an async throwable function so it returns an async result.
   */
  static fromThrowableAsync = ResultAsync.fromThrowable;

  /**
   * Combines multiple async results and stops on the first failure.
   */
  static combineAsync = ResultAsync.combine;

  /**
   * Combines multiple async results and collects every failure.
   */
  static combineAsyncWithAllErrors = ResultAsync.combineWithAllErrors;
}
