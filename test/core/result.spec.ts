import { describe, expect, it, vi } from 'vitest';

import {
  Result,
  ResultKit,
  ResultAsync,
  err,
  fail,
  isTypedError,
  ok,
  type AsyncResultError,
  type AsyncResultValue,
  type Err,
  type Ok,
  type Result as ResultShape,
  type ResultErr,
  type ResultError,
  type ResultOk,
  type ResultValue,
  type TypedError,
  type TypedErrorUnion,
} from '../../src/core';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T,
>() => T extends B ? 1 : 2
  ? true
  : false;

type AuthError = TypedErrorUnion<'unauthorized'>;
type UserError = TypedErrorUnion<'user_not_found'>;
type ValidationError = TypedErrorUnion<'validation_error'>;
type RichValidationError = TypedError<
  'validation_error',
  { field: string; reason: string }
> & {
  readonly code: 400;
};

describe('Result core', () => {
  it('constructs ok, fail, and generic err results', () => {
    const success = ok(42);
    const typedFailure = fail({
      type: 'validation_error',
      message: 'Payload is invalid',
      details: { field: 'email', reason: 'invalid_format' },
      code: 400,
    } satisfies RichValidationError);
    const genericFailure = err('boom');

    expect(success.isOk()).toBe(true);
    expect(success.value).toBe(42);
    expect(typedFailure.isErr()).toBe(true);
    expect(isTypedError(typedFailure.error)).toBe(true);
    expect(genericFailure.error).toBe('boom');
    expect(typedFailure.error.code).toBe(400);
    const preservedSubtype: RichValidationError = typedFailure.error;
    expect(preservedSubtype.details?.field).toBe('email');
  });

  it('supports discriminated-union narrowing on the ok flag and instance guards', () => {
    const result: ResultShape<string, number> =
      Math.random() > 0.5 ? ok('value') : err(123);

    if (result.ok) {
      const narrowed: Ok<string> = result;
      expect(narrowed.value).toBeTypeOf('string');
    } else {
      const narrowed: Err<number> = result;
      expect(typeof narrowed.error).toBe('number');
    }

    if (!result.ok) {
      const narrowed: Err<number> = result;
      expect(typeof narrowed.error).toBe('number');
    } else {
      const narrowed: Ok<string> = result;
      expect(narrowed.value).toBeTypeOf('string');
    }

    if (result.isOk()) {
      const narrowed: Ok<string> = result;
      expect(narrowed.value).toBeTypeOf('string');
    }

    if (result.isErr()) {
      const narrowed: Err<number> = result;
      expect(typeof narrowed.error).toBe('number');
    }
  });

  it('supports the branded ResultKit facade without reintroducing pipelines', () => {
    const result = ResultKit.ok('token')
      .andThen((token) =>
        token
          ? ResultKit.ok({ userId: 'u_123' })
          : ResultKit.fail({
              type: 'unauthorized',
              message: 'Missing token',
            }),
      )
      .andThen((session) => ResultKit.ok(session.userId));

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr('fallback')).toBe('u_123');
  });

  it('chains synchronous results, widens error unions, and exposes helper types', () => {
    const requireSession = (
      token: string,
    ): ResultShape<{ userId: string }, AuthError> =>
      token
        ? ok({ userId: 'u_123' })
        : fail({
            type: 'unauthorized',
            message: 'Missing token',
          });

    const findUser = (
      session: { userId: string },
    ): ResultShape<{ id: string }, UserError> =>
      session.userId === 'u_123'
        ? ok({ id: session.userId })
        : fail({
            type: 'user_not_found',
            message: 'User not found',
          });

    const result = ok('token').andThen(requireSession).andThen(findUser);
    const resultValueCheck: ResultValue<typeof result> = { id: 'u_123' };
    const resultErrorCheck = (
      error: ResultError<typeof result>,
    ): AuthError | UserError => error;
    const resultOkCheck = (
      value: ResultOk<ResultShape<string, number>>,
    ): Ok<string> => value;
    const resultErrCheck = (
      value: ResultErr<ResultShape<string, number>>,
    ): Err<number> => value;

    expect(resultValueCheck.id).toBe('u_123');
    expect(resultErrorCheck).toBeTypeOf('function');
    expect(resultOkCheck).toBeTypeOf('function');
    expect(resultErrCheck).toBeTypeOf('function');

    expect(result.isOk()).toBe(true);
    expect(result.match((value) => value.id, (error) => error.message)).toBe(
      'u_123',
    );
  });

  it('supports recovery and lazy unwrapping', () => {
    const result = fail({
      type: 'validation_error',
      message: 'Name is required',
    } satisfies ValidationError)
      .orElse(() => ok('anonymous'))
      .map((value) => value.toUpperCase());

    expect(result.unwrapOr('fallback')).toBe('ANONYMOUS');
    expect(
      fail({
        type: 'validation_error',
        message: 'Name is required',
      } satisfies ValidationError).unwrapOrElse((error) => error.type),
    ).toBe('validation_error');
  });

  it('runs tee and through helpers without disturbing the main result', () => {
    const onOk = vi.fn(() => {
      throw new Error('ignored');
    });
    const onErr = vi.fn(() => {
      throw new Error('ignored');
    });

    const success = ok('user')
      .andTee(onOk)
      .andThrough((value) => ok(value.length))
      .map((value) => value.toUpperCase());
    const failure = fail({
      type: 'validation_error',
      message: 'Bad input',
    } satisfies ValidationError).orTee(onErr);
    const gated = ok('user').andThrough(() =>
      fail({
        type: 'unauthorized',
        message: 'Denied',
      }),
    );

    expect(success.unwrapOr('missing')).toBe('USER');
    expect(failure.isErr()).toBe(true);
    expect(gated.isErr()).toBe(true);
    expect(onOk).toHaveBeenCalledWith('user');
    expect(onErr).toHaveBeenCalled();
  });

  it('bridges into ResultAsync via asyncMap and asyncAndThen', async () => {
    const asyncMapped = ok(2).asyncMap(async (value) => value * 3);
    const asyncChained = ok('u_123').asyncAndThen(async (userId) =>
      ok({ id: userId }),
    );
    const asyncValueCheck: AsyncResultValue<typeof asyncChained> = {
      id: 'u_123',
    };
    const asyncErrorCheck: Assert<
      Equal<AsyncResultError<typeof asyncChained>, never>
    > = true;

    expect(asyncValueCheck.id).toBe('u_123');
    void asyncErrorCheck;

    await expect(asyncMapped.unwrapOr(0)).resolves.toBe(6);
    await expect(asyncChained.unwrapOr({ id: 'fallback' })).resolves.toEqual({
      id: 'u_123',
    });
  });

  it('preserves narrowing for fromPredicate, fromNullable, and typed-error guards', () => {
    const mixedValue: string | number = Math.random() > 0.5 ? '42' : 42;
    const narrowed = Result.fromPredicate(
      mixedValue,
      (value): value is string => typeof value === 'string',
      'not_a_string' as const,
    );
    const maybeValue = (Math.random() > 0.5 ? 'value' : null) as
      | string
      | null
      | undefined;
    const nullable = Result.fromNullable(maybeValue, 'missing' as const);
    const unknownError: unknown = fail({
      type: 'validation_error',
      message: 'Payload is invalid',
    } satisfies ValidationError).error;
    const fromPredicateCheck: ResultShape<string, 'not_a_string'> = narrowed;
    const fromNullableCheck: ResultShape<string, 'missing'> = nullable;

    expect(fromPredicateCheck.isErr() || fromPredicateCheck.isOk()).toBe(true);
    expect(fromNullableCheck.isErr() || fromNullableCheck.isOk()).toBe(true);

    if (isTypedError(unknownError, 'validation_error')) {
      const narrowedError: ValidationError = unknownError;
      expect(narrowedError.type).toBe('validation_error');
      expect(unknownError.message).toBe('Payload is invalid');
    } else {
      expect.unreachable('validation_error guard should narrow the error');
    }
  });

  it('keeps only the valuable static helpers with tuple inference intact', () => {
    const parseJson = Result.fromThrowable(JSON.parse, () => ({
      type: 'validation_error',
      message: 'Invalid JSON',
    }));
    const typedResults = [
      ok('a') as ResultShape<string, ValidationError>,
      ok(2) as ResultShape<number, AuthError>,
    ] as const;

    const combined = Result.combine(typedResults);
    const combinedWithAllErrors = Result.combineWithAllErrors(typedResults);
    const combineCheck: ResultShape<
      [string, number],
      ValidationError | AuthError
    > = combined;
    const combineAllCheck: ResultShape<
      [string, number],
      (ValidationError | AuthError)[]
    > = combinedWithAllErrors;

    expect(combineCheck.isOk()).toBe(true);
    expect(combineAllCheck.isOk()).toBe(true);

    expect(Result.fromNullable('value', 'missing').isOk()).toBe(true);
    expect(Result.fromNullable(null, 'missing').isErr()).toBe(true);
    expect(Result.fromPredicate(4, (value) => value > 2, 'too_small').isOk()).toBe(
      true,
    );
    expect(parseJson('{bad json}').isErr()).toBe(true);

    expect(Result.combine([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(combined).toEqual(ok(['a', 2]));
    expect(
      Result.combineWithAllErrors([
        ok(1),
        err('a'),
        err('b'),
      ]),
    ).toEqual(err(['a', 'b']));
  });
});
