import { AbstractController, Post } from "@alliage/webserver";

export default class NoPromiseActionController extends AbstractController {
  @Post("/api/post-action")
  postAction() {
    return {};
  }
}
