import { Service } from "@alliage/service-loader";
import { AbstractController, Post, AbstractRequest } from "@alliage/webserver";

import { createHttpError } from "../../../error";

type Body = {
  age: number;
};

type Query = {
  country: string;
};

@Service("test1_controller")
export default class Test1Controller extends AbstractController {
  @Post("/api/check-age")
  public async checkAge(request: AbstractRequest<unknown, Query, Body>) {
    if (request.getBody().age < 18) {
      /**
       * Error raised when the user is not an adult
       */
      throw createHttpError(400, {
        message: "You must be an adult",
        minimumAge: 18,
      });
    }
    return {
      message: `You are ${request.getBody().age}`,
    };
  }
}
