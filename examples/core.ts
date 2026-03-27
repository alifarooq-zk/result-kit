import {
  ResultKit,
  fail,
  ok,
  type Result,
  type TypedErrorUnion,
} from "@zireal/result-kit";

type AuthError = TypedErrorUnion<"missing_token">;
type UserError = TypedErrorUnion<"not_found" | "validation_error">;

const requireSession = (
  token: string,
): Result<{ userId: string }, AuthError> => {
  if (!token.trim()) {
    return fail({
      type: "missing_token",
      message: "token is required",
    });
  }

  return ok({ userId: "123" });
};

const findUser = (
  id: string,
): Result<{ id: string; name: string }, UserError> => {
  if (!id.trim()) {
    return fail({
      type: "validation_error",
      message: "id is required",
    });
  }

  if (id !== "123") {
    return fail({
      type: "not_found",
      message: "User not found",
      details: { id },
    });
  }

  return ok({
    id,
    name: "Ada Lovelace",
  });
};

const result = ok("session-token")
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId));

const brandedResult = ResultKit
  .ok("session-token")
  .andThen(requireSession)
  .andThen((session) => findUser(session.userId));

console.log(result.match((user) => user.name, (error) => error.message));
console.log(brandedResult.match((user) => user.name, (error) => error.message));
