import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';

import { isTypedError } from '../core/error';
import type { Result, ResultAsync } from '../core/result';

/**
 * Describes the HTTP exception payload that should be produced for a failure.
 *
 * Returning this shape from `mapError` lets callers control HTTP status and
 * response body without constructing a Nest `HttpException` instance
 * themselves.
 *
 * @example
 * ```ts
 * const descriptor: HttpExceptionDescriptor = {
 *   status: 400,
 *   code: "BAD_INPUT",
 *   message: "Email is invalid",
 *   details: { field: "email" },
 * };
 * ```
 */
export interface HttpExceptionDescriptor {
  /**
   * HTTP status code to use for the generated exception.
   */
  readonly status?: number;

  /**
   * Stable application error code included in the response body.
   */
  readonly code?: string | number;

  /**
   * Human-readable error message included in the response body.
   */
  readonly message?: string;

  /**
   * Optional structured metadata added to the response body.
   */
  readonly details?: Record<string, unknown>;

  /**
   * Optional top-level Nest-style error label.
   */
  readonly error?: string;
}

/**
 * Configures how result failures should be mapped into Nest HTTP exceptions.
 *
 * @typeParam E Domain error type accepted by `mapError`.
 * @example
 * ```ts
 * const options: NestErrorOptions<{ type: string; message: string }> = {
 *   mapError: (error) =>
 *     error.type === "not_found"
 *       ? new NotFoundException(error.message)
 *       : undefined,
 * };
 * ```
 */
export interface NestErrorOptions<E> {
  /**
   * Optional custom mapper for converting a domain error into either a ready
   * `HttpException` or a descriptor used to build one.
   */
  readonly mapError?: (
    error: E,
  ) => HttpException | HttpExceptionDescriptor | undefined;

  /**
   * Fallback message used for unknown failures when a better message cannot be
   * derived from the error value.
   */
  readonly fallbackMessage?: string;
}

/**
 * Default message used when the incoming error value does not expose a usable
 * message.
 *
 * This is intentionally shared by the internal fallback paths so unknown
 * errors produce a stable response shape.
 */
const DEFAULT_UNKNOWN_MESSAGE = 'An unknown error occurred';

/**
 * Default application error code used for internal server failures.
 *
 * This keeps unknown and unhandled failures aligned across all fallback
 * branches.
 */
const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

/**
 * Normalizes an arbitrary error type string into an uppercase code suitable
 * for HTTP responses.
 *
 * @param value Raw error type value.
 * @returns A sanitized, uppercase error code or the internal default code.
 * @example
 * ```ts
 * const code = normalizeErrorCode("validation-error");
 * // "VALIDATION_ERROR"
 * ```
 */
const normalizeErrorCode = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || DEFAULT_ERROR_CODE;

/**
 * Builds a Nest `HttpException` from a lightweight descriptor object.
 *
 * @param descriptor Response descriptor to convert.
 * @returns A concrete `HttpException` with normalized payload defaults.
 * @example
 * ```ts
 * const exception = toHttpExceptionFromDescriptor({
 *   status: 404,
 *   code: "USER_NOT_FOUND",
 *   message: "User was not found",
 * });
 * ```
 */
const toHttpExceptionFromDescriptor = (
  descriptor: HttpExceptionDescriptor,
): HttpException => {
  const status = descriptor.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
  const payload = {
    code:
      descriptor.code ??
      (status === HttpStatus.INTERNAL_SERVER_ERROR
        ? DEFAULT_ERROR_CODE
        : String(status)),
    message: descriptor.message ?? DEFAULT_UNKNOWN_MESSAGE,
    ...(descriptor.details ? { details: descriptor.details } : {}),
    ...(descriptor.error ? { error: descriptor.error } : {}),
  };

  return new HttpException(payload, status);
};

/**
 * Converts an arbitrary error value into a Nest `HttpException`.
 *
 * Resolution order is:
 * 1. `options.mapError` returning a `HttpException`
 * 2. `options.mapError` returning a {@link HttpExceptionDescriptor}
 * 3. An incoming `HttpException`
 * 4. A core typed error
 * 5. A generic JavaScript `Error`
 * 6. An unknown fallback internal server error
 *
 * @param error Error value to convert.
 * @param options Optional mapping and fallback configuration.
 * @returns A Nest `HttpException` representing the provided error.
 * @example
 * ```ts
 * const exception = toHttpException({
 *   type: "validation_error",
 *   message: "Email is invalid",
 *   details: { field: "email" },
 * });
 * ```
 * @example
 * ```ts
 * const exception = toHttpException("missing_user", {
 *   mapError: (error) =>
 *     error === "missing_user"
 *       ? { status: 404, code: "USER_NOT_FOUND", message: "User missing" }
 *       : undefined,
 * });
 * ```
 */
export const toHttpException = <E>(
  error: E,
  options?: NestErrorOptions<E>,
): HttpException => {
  const mapped = options?.mapError?.(error);

  if (mapped instanceof HttpException) {
    return mapped;
  }

  if (mapped) {
    return toHttpExceptionFromDescriptor(mapped);
  }

  if (error instanceof HttpException) {
    return error;
  }

  if (isTypedError(error)) {
    return new InternalServerErrorException({
      code: normalizeErrorCode(error.type),
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error instanceof Error) {
    return new InternalServerErrorException({
      code: DEFAULT_ERROR_CODE,
      message: error.message || options?.fallbackMessage || DEFAULT_UNKNOWN_MESSAGE,
    });
  }

  return new InternalServerErrorException({
    code: DEFAULT_ERROR_CODE,
    message: options?.fallbackMessage || DEFAULT_UNKNOWN_MESSAGE,
  });
};

/**
 * Extracts the success value from a result or throws an HTTP exception derived
 * from the failure.
 *
 * This is intended for Nest controller and adapter boundaries where a result
 * should be converted into framework-native exception flow.
 *
 * @param result Result to unwrap.
 * @param options Optional error mapping and fallback configuration.
 * @returns The successful value when `result` is successful.
 * @throws {HttpException} When `result` is failed.
 * @example
 * ```ts
 * const user = unwrapOrThrow(ok({ id: "u_123" }));
 * ```
 * @example
 * ```ts
 * const user = unwrapOrThrow(
 *   err({ type: "not_found", message: "User missing" }),
 *   {
 *     mapError: (error) =>
 *       isTypedError(error, "not_found")
 *         ? { status: 404, code: "USER_NOT_FOUND", message: error.message }
 *         : undefined,
 *   },
 * );
 * ```
 */
export const unwrapOrThrow = <T, E>(
  result: Result<T, E>,
  options?: NestErrorOptions<E>,
): T => {
  if (result.ok) {
    return result.value;
  }

  throw toHttpException(result.error, options);
};

/**
 * Awaits a promised result and extracts its success value or throws a mapped
 * HTTP exception.
 *
 * Use this when service methods already resolve to `Promise<Result<...>>`.
 *
 * @param promise Promise resolving to a result.
 * @param options Optional error mapping and fallback configuration.
 * @returns A promise resolving to the successful value.
 * @throws {HttpException} When the resolved result is failed.
 * @example
 * ```ts
 * const user = await unwrapPromise(Promise.resolve(ok({ id: "u_123" })));
 * ```
 */
export const unwrapPromise = async <T, E>(
  promise: PromiseLike<Result<T, E>> | ResultAsync<T, E>,
  options?: NestErrorOptions<E>,
): Promise<T> => unwrapOrThrow(await promise, options);
