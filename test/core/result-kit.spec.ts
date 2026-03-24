import { describe, expect, expectTypeOf, it } from 'vitest';

import { ResultKit, type Failure, type Result, type TypedError } from '../../src/core';

describe('ResultKit core', () => {
  it('constructs typed failures through fail', () => {
    const result = ResultKit.fail({
      type: 'not_found',
      message: 'User not found',
      details: { userId: '123' },
      cause: new Error('lookup failed'),
    });

    expectTypeOf(result).toEqualTypeOf<Failure<TypedError<'not_found'>>>();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.type).toBe('not_found');
    expect(result.error.details).toEqual({ userId: '123' });
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it('detects typed errors at runtime', () => {
    expect(
      ResultKit.isTypedError({
        type: 'validation_error',
        message: 'Query is required',
        details: { field: 'query' },
        cause: { upstream: true },
      }),
    ).toBe(true);

    expect(ResultKit.isTypedError({ type: 'validation_error' })).toBe(false);
    expect(
      ResultKit.isTypedError({
        type: 'validation_error',
        message: 'Query is required',
        details: ['query'],
      }),
    ).toBe(false);
  });

  it('keeps generic non-typed errors working through failure and mapError', () => {
    const failed: Result<number, string> = ResultKit.failure('boom');
    const mapped = ResultKit.mapError(failed, (error) => error.length);

    expect(mapped).toEqual({
      ok: false,
      error: 4,
    });
  });

  it('combines results and collects all errors when requested', () => {
    const combined = ResultKit.combine([
      ResultKit.success(1),
      ResultKit.success(2),
    ]);
    const allErrors = ResultKit.combineWithAllErrors([
      ResultKit.success(1),
      ResultKit.failure('a'),
      ResultKit.failure('b'),
    ]);

    expect(combined).toEqual({ ok: true, value: [1, 2] });
    expect(allErrors).toEqual({ ok: false, error: ['a', 'b'] });
  });

  it('wraps throwing sync and async code into results', async () => {
    const parseJson = ResultKit.fromThrowable(JSON.parse, () => ({
      type: 'parse_error',
      message: 'Invalid JSON',
    }));
    const fromPromise = await ResultKit.fromPromise(
      Promise.reject(new Error('nope')),
      (error) => ({
        type: 'promise_error',
        message: error instanceof Error ? error.message : String(error),
      }),
    );

    expect(parseJson('{bad json}')).toEqual({
      ok: false,
      error: {
        type: 'parse_error',
        message: 'Invalid JSON',
      },
    });
    expect(fromPromise).toEqual({
      ok: false,
      error: {
        type: 'promise_error',
        message: 'nope',
      },
    });
  });
});
