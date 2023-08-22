import { Service } from "@alliage/service-loader";
import { AbstractController, Post, AbstractRequest } from "@alliage/webserver";

import { createHttpError } from "../../../error";

type Employee = {
  name: string;
  directReports: Employee[];
};

type Body = {
  employees: Employee[];
};

@Service("test3_controller")
export default class Test3Controller extends AbstractController {
  /**
   * @defaultStatusCode 204
   */
  @Post("/api/hierarchy")
  public sayHello(request: AbstractRequest<undefined, undefined, Body>) {
    console.log(request.getBody());

    throw createHttpError(401, undefined);
  }
}
