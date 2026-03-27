import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { ResultAsync, fail, isTypedError, ok } from "../../src/core";
import { toHttpException, unwrapOrThrow, unwrapPromise } from "../../src/nest";

describe("@zireal/result-kit/nest", () => {
  it("unwraps successful results without throwing", () => {
    const value = unwrapOrThrow(ok(42));

    expect(value).toBe(42);
  });

  it("converts typed errors to internal server exceptions by default", () => {
    const error = fail({
      type: "validation_error",
      message: "Payload is invalid",
      details: { field: "email" },
    }).error;

    const exception = toHttpException(error);

    expect(exception).toBeInstanceOf(InternalServerErrorException);
    expect(exception.getResponse()).toEqual({
      code: "VALIDATION_ERROR",
      message: "Payload is invalid",
      details: { field: "email" },
    });
  });

  it("supports caller-provided Nest mapping", () => {
    const result = fail({
      type: "validation_error",
      message: "Payload is invalid",
      details: { field: "email" },
    });

    expect(() =>
      unwrapOrThrow(result, {
        mapError: (error) =>
          isTypedError(error) && error.type === "validation_error"
            ? new BadRequestException({
                code: "BAD_INPUT",
                message: error.message,
                details: error.details,
              })
            : undefined,
      }),
    ).toThrow(BadRequestException);
  });

  it("unwraps promise results and falls back on unknown errors", async () => {
    await expect(
      unwrapPromise(Promise.resolve(ok("ok"))),
    ).resolves.toBe("ok");
    await expect(
      unwrapPromise(ResultAsync.fromPromise(Promise.resolve("ok"), () => "boom")),
    ).resolves.toBe("ok");

    const exception = toHttpException({ nope: true });

    expect(exception).toBeInstanceOf(InternalServerErrorException);
    expect(exception.getResponse()).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unknown error occurred",
    });
  });
});
