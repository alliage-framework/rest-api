import { AbstractController, Get, Post } from "@alliage/webserver";

export default class ValidationController extends AbstractController {
  /**
   * @validateInput false
   * @validateOutput true
   */
  @Get("/api/get-action")
  async getAction() {
    return {};
  }

  /**
   * @validateInput true
   * @validateOutput false
   */
  @Post("/api/post-action")
  async postAction() {
    return {};
  }
}
