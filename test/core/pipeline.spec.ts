import { describe, expect, expectTypeOf, it } from 'vitest';

import { ResultKit, type Result, type TypedErrorUnion } from '../../src/core';

type AuthError = TypedErrorUnion<'unauthorized'>;
type UserError = TypedErrorUnion<'user_not_found'>;
type BillingError = TypedErrorUnion<'invoice_not_found'>;

describe('ResultPipeline', () => {
  it('starts from a raw value and widens error unions across sync steps', () => {
    const requireSession = (
      token: string,
    ): Result<{ userId: string }, AuthError> =>
      token
        ? ResultKit.success({ userId: 'u_123' })
        : ResultKit.fail({
            type: 'unauthorized',
            message: 'Missing token',
          });

    const findUser = (
      session: { userId: string },
    ): Result<{ id: string }, UserError> =>
      ResultKit.success({ id: session.userId });

    const loadInvoice = (
      user: { id: string },
    ): Result<{ id: string; userId: string }, BillingError> =>
      ResultKit.success({ id: 'inv_1', userId: user.id });

    const result = ResultKit
      .pipe('token')
      .andThen(requireSession)
      .andThen(findUser)
      .andThen(loadInvoice)
      .done();

    expectTypeOf(result).toEqualTypeOf<
      Result<{ id: string; userId: string }, AuthError | UserError | BillingError>
    >();
    expect(result).toEqual({
      ok: true,
      value: { id: 'inv_1', userId: 'u_123' },
    });
  });

  it('starts from an existing failure result and short-circuits later sync steps', () => {
    let calls = 0;

    const result = ResultKit
      .pipe(
        ResultKit.fail({
          type: 'unauthorized',
          message: 'Missing token',
        }),
      )
      .andThen(() => {
        calls += 1;
        return ResultKit.success({ id: 'u_123' });
      })
      .done();

    expect(calls).toBe(0);
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unauthorized',
        message: 'Missing token',
      },
    });
  });

  it('starts from promises and widens error unions across async steps', async () => {
    const requireSessionAsync = async (
      token: string,
    ): Promise<Result<{ userId: string }, AuthError>> =>
      token
        ? ResultKit.success({ userId: 'u_123' })
        : ResultKit.fail({
            type: 'unauthorized',
            message: 'Missing token',
          });

    const findUserAsync = async (
      session: { userId: string },
    ): Promise<Result<{ id: string }, UserError>> =>
      ResultKit.success({ id: session.userId });

    const result = await ResultKit
      .pipeAsync(Promise.resolve('token'))
      .andThen(requireSessionAsync)
      .andThen(findUserAsync)
      .done();

    expectTypeOf(result).toEqualTypeOf<
      Result<{ id: string }, AuthError | UserError>
    >();
    expect(result).toEqual({
      ok: true,
      value: { id: 'u_123' },
    });
  });

  it('short-circuits later async steps after the first failure', async () => {
    let calls = 0;

    const result = await ResultKit
      .pipeAsync(
        Promise.resolve(
          ResultKit.fail({
            type: 'unauthorized',
            message: 'Missing token',
          }),
        ),
      )
      .andThen(async () => {
        calls += 1;
        return ResultKit.success({ id: 'u_123' });
      })
      .done();

    expect(calls).toBe(0);
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unauthorized',
        message: 'Missing token',
      },
    });
  });
});
