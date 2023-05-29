import { AbstractController, Get } from "@alliage/webserver";

export class NoDefaultExportController extends AbstractController {
  @Get("/api/get-action")
  async getAction() {
    return {};
  }
}
