import { describe, expect, it, vi } from 'vitest';

import {
  Result,
  ResultAsync,
  err,
  fail,
  ok,
  type AsyncResultError,
  type AsyncResultValue,
  type Result as SyncResult,
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

describe('ResultAsync', () => {
  it('creates async results from promises and async throwables', async () => {
    const fromPromise = ResultAsync.fromPromise(
      Promise.reject(new Error('nope')),
      (error) => ({
        type: 'unauthorized',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    const fromThrowable = ResultAsync.fromThrowable(
      async (input: string) => JSON.parse(input) as { ok: boolean },
      () => ({
        type: 'user_not_found',
        message: 'Invalid JSON',
      }),
    );

    await expect(fromPromise).resolves.toEqual(
      fail({
        type: 'unauthorized',
        message: 'nope',
      }),
    );
    await expect(fromThrowable('{bad json}')).resolves.toEqual(
      fail({
        type: 'user_not_found',
        message: 'Invalid JSON',
      }),
    );
  });

  it('chains asynchronously and widens error unions', async () => {
    const requireSession = (
      token: string,
    ): ResultAsync<{ userId: string }, AuthError> =>
      token
        ? ResultAsync.fromPromise(Promise.resolve({ userId: 'u_123' }), () => ({
            type: 'unauthorized',
            message: 'Missing token',
          }))
        : ResultAsync.fromPromise(Promise.reject(new Error('missing')), () => ({
            type: 'unauthorized',
            message: 'Missing token',
          }));

    const findUser = async (
      session: { userId: string },
    ): Promise<SyncResult<{ id: string }, UserError>> =>
      ok({ id: session.userId });

    const result = ResultAsync.fromPromise(Promise.resolve('token'), (): AuthError => ({
      type: 'unauthorized',
      message: 'Missing token',
    }))
      .andThen(requireSession)
      .andThen(findUser);
    const asyncValueCheck: AsyncResultValue<typeof result> = {
      id: 'u_123',
    };
    const asyncErrorCheck = (
      error: AsyncResultError<typeof result>,
    ): AuthError | UserError => error;

    expect(asyncValueCheck.id).toBe('u_123');
    expect(asyncErrorCheck).toBeTypeOf('function');

    await expect(result).resolves.toEqual(ok({ id: 'u_123' }));
  });

  it('keeps mixed Result, ResultAsync, and PromiseLike<Result> chains fluent', async () => {
    const loadSession = (token: string) => {
      if (token === 'direct') {
        return ok({ userId: token });
      }

      if (token === 'async') {
        return ResultAsync.fromPromise(
          Promise.resolve({ userId: token }),
          (): AuthError => ({
            type: 'unauthorized',
            message: 'Missing token',
          }),
        );
      }

      return Promise.resolve(
        fail({
          type: 'unauthorized',
          message: 'Missing token',
        } satisfies AuthError),
      );
    };

    const loadUser = (session: { userId: string }) =>
      session.userId === 'direct'
        ? ok({ id: session.userId, role: 'admin' as const })
        : Promise.resolve(
            ok({ id: session.userId, role: 'member' as const }),
          );

    const result = ResultAsync.fromPromise(
      Promise.resolve('direct'),
      (): AuthError => ({
        type: 'unauthorized',
        message: 'Missing token',
      }),
    )
      .andThen(loadSession)
      .andThen(loadUser)
      .andThrough((user) =>
        user.id ? ResultAsync.fromPromise(Promise.resolve(user.id.length), () => 'never') : ok(0),
      )
      .map((user) => user.role);

    await expect(result).resolves.toEqual(ok('admin'));
  });

  it('supports async mapErr, match, tee, and through helpers', async () => {
    const okSpy = vi.fn();
    const errSpy = vi.fn();

    const success = ResultAsync.fromPromise(Promise.resolve(2), () => 'boom')
      .map((value) => value + 1)
      .andTee(async (value) => {
        okSpy(value);
      })
      .andThrough(async () => ok('side'))
      .match(
        (value) => value * 2,
        () => 0,
      );

    const failure = ResultAsync.fromPromise(
      Promise.reject(new Error('boom')),
      () => ({
        type: 'unauthorized',
        message: 'boom',
      }),
    )
      .mapErr((error) => ({
        ...error,
        message: error.message.toUpperCase(),
      }))
      .orTee(async (error) => {
        errSpy(error.type);
      })
      .match(
        () => 'ok',
        (error) => error.message,
      );

    await expect(success).resolves.toBe(6);
    await expect(failure).resolves.toBe('BOOM');
    expect(okSpy).toHaveBeenCalledWith(3);
    expect(errSpy).toHaveBeenCalledWith('unauthorized');
  });

  it('combines async results and collects all errors when requested', async () => {
    const combined = ResultAsync.combine([
      Promise.resolve(ok(1)),
      Promise.resolve(ok(2)),
    ] as const);
    const allErrors = ResultAsync.combineWithAllErrors([
      Promise.resolve(ok(1) as SyncResult<number, AuthError>),
      Promise.resolve(ok(2) as SyncResult<number, UserError>),
    ] as const);
    const combineCheck: ResultAsync<[number, number], never> = combined;
    const combineAllCheck: ResultAsync<
      [number, number],
      (AuthError | UserError)[]
    > = allErrors;

    expect(combineCheck).toBeInstanceOf(ResultAsync);
    expect(combineAllCheck).toBeInstanceOf(ResultAsync);

    await expect(combined).resolves.toEqual(ok([1, 2]));
    await expect(allErrors).resolves.toEqual(ok([1, 2]));
  });

  it('reuses sync Result combination at the promise boundary', async () => {
    const result = await ResultAsync.combine([
      Promise.resolve(Result.combine([ok('a'), ok('b')] as const)),
    ] as const);

    await expect(Promise.resolve(result)).resolves.toEqual(ok([['a', 'b']]));
  });
});
