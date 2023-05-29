import { AbstractController, Get } from "@alliage/webserver";

export default class InvalidStatusCodeController extends AbstractController {
  /**
   * @defaultStatusCode not_a_number
   */
  @Get("/api/get-action")
  async getAction() {
    return {};
  }
}
