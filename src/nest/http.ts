import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';

import { isTypedError } from '../core/error';
import type { Result } from '../core/result';
import { ResultKit } from '../core/result-kit';

export interface HttpExceptionDescriptor {
  readonly status?: number;
  readonly code?: string | number;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly error?: string;
}

export interface NestErrorOptions<E> {
  readonly mapError?: (
    error: E,
  ) => HttpException | HttpExceptionDescriptor | undefined;
  readonly fallbackMessage?: string;
}

const DEFAULT_UNKNOWN_MESSAGE = 'An unknown error occurred';
const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

const normalizeErrorCode = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || DEFAULT_ERROR_CODE;

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

export const unwrapOrThrow = <T, E>(
  result: Result<T, E>,
  options?: NestErrorOptions<E>,
): T => {
  if (ResultKit.isSuccess(result)) {
    return result.value;
  }

  throw toHttpException(result.error, options);
};

export const unwrapPromise = async <T, E>(
  promise: Promise<Result<T, E>>,
  options?: NestErrorOptions<E>,
): Promise<T> => unwrapOrThrow(await promise, options);
