import { AbstractController, AbstractRequest, Post } from "@alliage/webserver";
import { Service } from "@alliage/service-loader";

type Params = {
  /**
   * @pattern "[a-zA-Z]+"
   */
  name: string;
};

type Query = {
  language?: "fr" | "en";
};

type Body = {
  age: number;
};

@Service("main_controller")
export default class MainController extends AbstractController {
  @Post("/api/hello/:name")
  async sayHello(request: AbstractRequest<Params, Query, Body>) {
    const name = request.getParams().name;
    const lang = request.getQuery().language;
    const age = request.getBody().age;
    return {
      message:
        lang === "fr"
          ? `Bonjour ${name}, tu as ${age} ans`
          : `Hello ${name}, you are ${age}`,
    };
  }
}
