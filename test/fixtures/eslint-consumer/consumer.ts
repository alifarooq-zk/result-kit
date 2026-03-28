import { ResultAsync, fail, ok, type TypedErrorUnion } from '@zireal/result-kit';

type AuthError = TypedErrorUnion<'unauthorized'>;
type UserError = TypedErrorUnion<'user_not_found'>;
type ValidationError = TypedErrorUnion<'validation_error'>;

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

const consumerFlow = ResultAsync.fromPromise(
  Promise.resolve('direct'),
  (): ValidationError => ({
    type: 'validation_error',
    message: 'Invalid request',
  }),
)
  .andThen(loadSession)
  .andThen((session) => {
    session.userId.toUpperCase();
    return loadUser(session);
  })
  .orElse((error) => {
    error.message.toUpperCase();
    return error.type === 'validation_error'
      ? ok({ id: 'guest', role: 'guest' as const })
      : Promise.resolve(ok({ id: 'fallback', role: 'member' as const }));
  })
  .andThrough((user) => {
    user.id.toUpperCase();
    return user.id
      ? Promise.resolve(ok(user.id.length))
      : ResultAsync.fromPromise(
          Promise.reject(new Error('missing')),
          (): ValidationError => ({
            type: 'validation_error',
            message: 'Missing id',
          }),
        );
  })
  .map((user) => `${user.id}:${user.role}`);

void consumerFlow;
