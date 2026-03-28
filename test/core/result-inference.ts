import {
  ResultAsync,
  fail,
  ok,
  type AsyncResultError,
  type AsyncResultValue,
  type Result,
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

const requireSession = (
  token: string,
): Result<{ userId: string }, AuthError> =>
  token
    ? ok({ userId: token })
    : fail({
        type: 'unauthorized',
        message: 'Missing token',
      } satisfies AuthError);

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

const loadUser = (session: { userId: string }) => {
  if (session.userId === 'direct') {
    return ok({ id: session.userId, role: 'admin' as const });
  }

  if (session.userId === 'async') {
    return ResultAsync.fromPromise(
      Promise.resolve({ id: session.userId, role: 'member' as const }),
      (): UserError => ({
        type: 'user_not_found',
        message: 'User not found',
      }),
    );
  }

  return Promise.resolve(
    fail({
      type: 'user_not_found',
      message: 'User not found',
    } satisfies UserError),
  );
};

const syncChain = ok('token')
  .andThen(requireSession)
  .andThen((session) => {
    session.userId.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    session.missing;
    return ok({ id: session.userId });
  })
  .map((user) => {
    user.id.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    user.missing;
    return user.id;
  });

const syncMessage = syncChain.match(
  (value) => value.toUpperCase(),
  (error) => error.message,
);

const mixedAsyncChain = ResultAsync.fromPromise(
  Promise.resolve('direct'),
  (): AuthError => ({
    type: 'unauthorized',
    message: 'Missing token',
  }),
)
  .andThen(loadSession)
  .andThen((session) => {
    session.userId.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    session.missing;
    return loadUser(session);
  })
  .map((user) => {
    user.id.toUpperCase();
    user.role.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    user.missing;
    return `${user.id}:${user.role}`;
  });

const mixedAsyncValueCheck: AsyncResultValue<typeof mixedAsyncChain> =
  'direct:admin';
const mixedAsyncErrorCheck = (
  error: AsyncResultError<typeof mixedAsyncChain>,
): AuthError | UserError => error;

const recoveredChain = ResultAsync.fromPromise(
  Promise.reject(new Error('invalid')),
  (): ValidationError => ({
    type: 'validation_error',
    message: 'Invalid request',
  }),
)
  .orElse((error) => {
    error.message.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    error.missing;

    return error.type === 'validation_error'
      ? ok({ id: 'guest', role: 'guest' as const })
      : Promise.resolve(ok({ id: 'member', role: 'member' as const }));
  })
  .andThrough((user) => {
    user.id.toUpperCase();
    // @ts-expect-error callback payload must stay typed.
    user.missing;

    return user.id
      ? Promise.resolve(ok(user.id.length))
      : ResultAsync.fromPromise(
          Promise.reject(new Error('missing')),
          (): ValidationError => ({
            type: 'validation_error',
            message: 'Missing id',
          }),
        );
  });

const recoveredValueCheck: AsyncResultValue<typeof recoveredChain> = {
  id: 'guest',
  role: 'guest',
};
const recoveredErrorCheck = (
  error: AsyncResultError<typeof recoveredChain>,
): ValidationError => error;

void mixedAsyncValueCheck;
void mixedAsyncErrorCheck;
void recoveredValueCheck;
void recoveredErrorCheck;
void syncMessage;
