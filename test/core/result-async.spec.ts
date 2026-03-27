import { describe, expect, it, vi } from 'vitest';

import {
  Result,
  ResultAsync,
  err,
  fail,
  ok,
  type Result as SyncResult,
  type TypedErrorUnion,
} from '../../src/core';

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

    const result = ResultAsync.fromPromise(Promise.resolve('token'), () => ({
      type: 'unauthorized',
      message: 'Missing token',
    }))
      .andThen(requireSession)
      .andThen(findUser);

    await expect(result).resolves.toEqual(ok({ id: 'u_123' }));
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

    const failure = ResultAsync.fromPromise(Promise.reject(new Error('boom')), () => ({
      type: 'unauthorized',
      message: 'boom',
    }))
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
    ]);
    const allErrors = ResultAsync.combineWithAllErrors([
      Promise.resolve(ok(1)),
      Promise.resolve(err('a')),
      Promise.resolve(err('b')),
    ]);

    await expect(combined).resolves.toEqual(ok([1, 2]));
    await expect(allErrors).resolves.toEqual(err(['a', 'b']));
  });

  it('reuses sync Result combination at the promise boundary', async () => {
    const result = await ResultAsync.combine([
      Promise.resolve(Result.combine([ok('a'), ok('b')])),
    ]);

    await expect(Promise.resolve(result)).resolves.toEqual(ok([['a', 'b']]));
  });
});
