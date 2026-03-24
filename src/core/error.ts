export interface TypedError<TType extends string = string> {
  readonly type: TType;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

export type TypedErrorOf<TType extends string> = TypedError<TType>;

export type TypedErrorUnion<TType extends string> = TType extends string
  ? TypedError<TType>
  : never;

export const isTypedError = (error: unknown): error is TypedError<string> => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    type?: unknown;
    message?: unknown;
    details?: unknown;
  };

  if (
    typeof candidate.type !== 'string' ||
    typeof candidate.message !== 'string'
  ) {
    return false;
  }

  if (
    'details' in candidate &&
    candidate.details !== undefined &&
    (candidate.details === null ||
      typeof candidate.details !== 'object' ||
      Array.isArray(candidate.details))
  ) {
    return false;
  }

  return true;
};
