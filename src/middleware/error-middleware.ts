import { EventManager } from "@alliage/lifecycle";
import { REQUEST_PHASE, AbstractMiddleware, Context } from "@alliage/webserver";

import { RestAPIPostErrorEvent, RestAPIPreErrorEvent } from "../events";
import { HttpError } from "../error";

export class ErrorMiddleware extends AbstractMiddleware {
  constructor(private eventManager: EventManager, private env: string) {
    super();
  }

  getRequestPhase = () => REQUEST_PHASE.POST_CONTROLLER;

  async apply(context: Context, error: Error) {
    const request = context.getRequest();
    const response = context.getResponse();

    const preErrorEvent = new RestAPIPreErrorEvent(
      request,
      error,
      error instanceof HttpError ? error.code : 500,
      error instanceof HttpError
        ? error.payload
        : {
            message: "Internal error",
            debug:
              this.env === "development"
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : undefined,
          }
    );
    await this.eventManager.emit(preErrorEvent.getType(), preErrorEvent);

    const code = preErrorEvent.getCode();
    const body = preErrorEvent.getBody();

    response.setStatus(code).setBody(body);
    response.end();

    const postErrorEvent = new RestAPIPostErrorEvent(
      request,
      error,
      code,
      body
    );
    await this.eventManager.emit(postErrorEvent.getType(), postErrorEvent);
  }
}
