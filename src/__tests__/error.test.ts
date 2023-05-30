import { createHttpError, HttpError } from "../error";

describe("error", () => {
  describe("createHttpError", () => {
    const error = createHttpError(500, {
      message: "Internal error",
    });

    it("should create an HTTP error", () => {
      expect(error).toBeInstanceOf(HttpError);
      expect(error.code).toBe(500);
      expect(error.payload).toEqual({
        message: "Internal error",
      });
    });

    describe("#getData", () => {
      it("should return the error data", () => {
        expect(error.getData()).toEqual({
          code: 500,
          payload: {
            message: "Internal error",
          },
        });
      });
    });
  });
});
