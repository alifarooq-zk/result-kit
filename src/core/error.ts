/**
 * Structured application error shape used throughout the package.
 *
 * `TypedError` gives failures a stable string discriminator through `type`
 * while preserving a human-readable `message` and optional machine-readable
 * metadata.
 *
 * @typeParam TType Stable discriminator used for narrowing and mapping.
 * @typeParam TDetails Optional structured payload attached to `details`.
 * @example
 * ```ts
 * type ValidationError = TypedError<
 *   "validation_error",
 *   { field: string; reason: string }
 * >;
 *
 * const error: ValidationError = {
 *   type: "validation_error",
 *   message: "Email is invalid",
 *   details: {
 *     field: "email",
 *     reason: "invalid_format",
 *   },
 * };
 * ```
 */
export interface TypedError<
  TType extends string = string,
  TDetails extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
> {
  /**
   * Stable error discriminator used for narrowing, branching, and mapping.
   */
  readonly type: TType;

  /**
   * Human-readable description of the failure.
   */
  readonly message: string;

  /**
   * Optional serializable metadata describing the failure context.
   */
  readonly details?: TDetails;

  /**
   * Optional original cause for debugging or tracing.
   */
  readonly cause?: unknown;
}

/**
 * Alias that makes it explicit that a typed error is constrained to one
 * concrete discriminator.
 *
 * @typeParam TType Stable discriminator used for narrowing and mapping.
 * @typeParam TDetails Optional structured payload attached to `details`.
 * @example
 * ```ts
 * type NotFoundError = TypedErrorOf<"not_found">;
 *
 * const error: NotFoundError = {
 *   type: "not_found",
 *   message: "User was not found",
 * };
 * ```
 */
export type TypedErrorOf<
  TType extends string,
  TDetails extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
> = TypedError<TType, TDetails>;

/**
 * Produces a union of {@link TypedError} variants from a union of string
 * discriminators.
 *
 * This is useful for defining domain-specific error unions such as
 * `"not_found" | "validation_error"`.
 *
 * @typeParam TType Union of error discriminator strings.
 * @example
 * ```ts
 * type UserError = TypedErrorUnion<"not_found" | "validation_error">;
 *
 * const error: UserError = {
 *   type: "validation_error",
 *   message: "Name is required",
 * };
 * ```
 */
export type TypedErrorUnion<TType extends string> = TType extends string
  ? TypedError<TType>
  : never;

/**
 * Determines whether an unknown value satisfies the runtime contract of
 * {@link TypedError}.
 *
 * A valid typed error must be an object with string `type` and `message`
 * fields. When present, `details` must be a plain object-like record rather
 * than `null` or an array.
 *
 * @param error Value to validate at runtime.
 * @param type Optional discriminator to require in addition to the base
 * `TypedError` contract.
 * @returns `true` when `error` matches the expected structured error shape.
 * @example
 * ```ts
 * const candidate: unknown = {
 *   type: "validation_error",
 *   message: "Payload is invalid",
 * };
 *
 * if (isTypedError(candidate)) {
 *   console.log(candidate.type);
 * }
 * ```
 * @example
 * ```ts
 * const candidate: unknown = {
 *   type: "not_found",
 *   message: "User was not found",
 * };
 *
 * if (isTypedError(candidate, "not_found")) {
 *   console.log(candidate.message);
 * }
 * ```
 */
export function isTypedError(error: unknown): error is TypedError<string>;
export function isTypedError<TType extends string>(
  error: unknown,
  type: TType,
): error is TypedError<TType>;
export function isTypedError<TType extends string>(
  error: unknown,
  type?: TType,
): error is TypedError<string> {
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

  if (type !== undefined && candidate.type !== type) {
    return false;
  }

  return true;
}
