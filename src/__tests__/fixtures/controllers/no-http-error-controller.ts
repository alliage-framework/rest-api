import { AbstractController, Post } from "@alliage/webserver";

import { createHttpError } from "../../../error";

class CustomError extends Error {}

export default class NoHttpErrorController extends AbstractController {
  @Post("/api/post-action")
  async postAction() {
    const number = Math.random();
    if (number > 0.5) {
      // Not a class error
      throw 42;
    }

    if (number > 0.4 && number < 0.5) {
      // Not a HttpError instance
      throw new Error();
    }

    if (number > 0.2 && number < 0.3) {
      // Not a HttpError instance
      throw new CustomError();
    }

    if (number < 0.1) {
      throw createHttpError(400, { message: "error" });
    }

    return {};
  }
}
