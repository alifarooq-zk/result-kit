import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  Result,
  ResultKit,
  ResultAsync,
  err,
  fail,
  isTypedError,
  ok,
  type TypedErrorUnion,
} from '../../src/core';

type AuthError = TypedErrorUnion<'unauthorized'>;
type UserError = TypedErrorUnion<'user_not_found'>;
type ValidationError = TypedErrorUnion<'validation_error'>;

describe('Result core', () => {
  it('constructs ok, fail, and generic err results', () => {
    const success = ok(42);
    const typedFailure = fail({
      type: 'validation_error',
      message: 'Payload is invalid',
      details: { field: 'email' },
    });
    const genericFailure = err('boom');

    expect(success.isOk()).toBe(true);
    expect(success.value).toBe(42);
    expect(typedFailure.isErr()).toBe(true);
    expect(isTypedError(typedFailure.error)).toBe(true);
    expect(genericFailure.error).toBe('boom');
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

  it('chains synchronous results and widens error unions', () => {
    const requireSession = (
      token: string,
    ): Result<{ userId: string }, AuthError> =>
      token
        ? ok({ userId: 'u_123' })
        : fail({
            type: 'unauthorized',
            message: 'Missing token',
          });

    const findUser = (
      session: { userId: string },
    ): Result<{ id: string }, UserError> =>
      session.userId === 'u_123'
        ? ok({ id: session.userId })
        : fail({
            type: 'user_not_found',
            message: 'User not found',
          });

    const result = ok('token').andThen(requireSession).andThen(findUser);

    expectTypeOf(result).toEqualTypeOf<
      Result<{ id: string }, AuthError | UserError>
    >();
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

    expectTypeOf(asyncMapped).toEqualTypeOf<ResultAsync<number, never>>();
    await expect(asyncMapped.unwrapOr(0)).resolves.toBe(6);
    await expect(asyncChained.unwrapOr({ id: 'fallback' })).resolves.toEqual({
      id: 'u_123',
    });
  });

  it('keeps only the valuable static helpers', () => {
    const parseJson = Result.fromThrowable(JSON.parse, () => ({
      type: 'validation_error',
      message: 'Invalid JSON',
    }));

    expect(Result.fromNullable('value', 'missing').isOk()).toBe(true);
    expect(Result.fromNullable(null, 'missing').isErr()).toBe(true);
    expect(Result.fromPredicate(4, (value) => value > 2, 'too_small').isOk()).toBe(
      true,
    );
    expect(parseJson('{bad json}').isErr()).toBe(true);

    expect(Result.combine([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(
      Result.combineWithAllErrors([
        ok(1),
        err('a'),
        err('b'),
      ]),
    ).toEqual(err(['a', 'b']));
  });
});
