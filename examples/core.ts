import {
  ResultKit,
  type Result,
  type TypedErrorUnion,
} from "@zireal/result-kit";

type UserError = TypedErrorUnion<"not_found" | "validation_error">;

const findUser = (
  id: string,
): Result<{ id: string; name: string }, UserError> => {
  if (!id.trim()) {
    return ResultKit.fail({
      type: "validation_error",
      message: "id is required",
    });
  }

  if (id !== "123") {
    return ResultKit.fail({
      type: "not_found",
      message: "User not found",
      details: { id },
    });
  }

  return ResultKit.success({
    id,
    name: "Ada Lovelace",
  });
};

const result = findUser("123");

console.log(
  ResultKit.match(result, {
    onSuccess: (user) => user.name,
    onFailure: (error) => error.message,
  }),
);
