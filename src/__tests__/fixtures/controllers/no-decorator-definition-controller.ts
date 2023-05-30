import { AbstractController, Post } from "@alliage/webserver";

export default class NoDecoratorDefinitionController extends AbstractController {
  @Get("/api/get-action")
  async getAction() {
    return {};
  }

  @Post("/api/post-action")
  async postAction() {
    return {};
  }
}
