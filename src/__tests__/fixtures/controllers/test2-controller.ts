import { Service } from "@alliage/service-loader";
import { AbstractController, Get, AbstractRequest } from "@alliage/webserver";

import { createHttpError } from "../../../error";

type Params = {
  /**
   * @pattern "[a-zA-Z]+"
   */
  name: string;
};

type Query = {
  language?: "fr" | "en";
};

@Service("test2_controller")
export default class Test2Controller extends AbstractController {
  @Get("/api/hello/:name")
  public async sayHello(request: AbstractRequest<Params, Query>) {
    if (request.getQuery().language === "fr") {
      /**
       * Error raised when the user requested French language
       */
      throw createHttpError(400, {
        message: "French language is not yet available",
      });
    }
    return {
      message: `Hello ${request.getBody().name}`,
    };
  }
}
