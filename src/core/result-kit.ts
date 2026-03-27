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
 * `ResultKit` exists as a package-level entrypoint only. Result behavior still
 * lives on `Ok`, `Err`, `Result`, and `ResultAsync`.
 */
export abstract class ResultKit {
  static ok = ok;

  static fail = fail;

  static err = err;

  static okAsync = okAsync;

  static errAsync = errAsync;

  static fromThrowable = Result.fromThrowable;

  static fromNullable = Result.fromNullable;

  static fromPredicate = Result.fromPredicate;

  static combine = Result.combine;

  static combineWithAllErrors = Result.combineWithAllErrors;

  static fromPromise = ResultAsync.fromPromise;

  static fromThrowableAsync = ResultAsync.fromThrowable;

  static combineAsync = ResultAsync.combine;

  static combineAsyncWithAllErrors = ResultAsync.combineWithAllErrors;
}
