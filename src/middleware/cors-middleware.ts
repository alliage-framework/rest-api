import { REQUEST_PHASE, AbstractMiddleware, Context } from "@alliage/webserver";

import { Config } from "../config/main";
import { addAccessControlHeaders } from "../utils/http";

/**
 * Add the CORS headers in the response
 */
export class CORSMiddleware extends AbstractMiddleware {
  constructor(private corsConfigs: Config["allowedOrigins"]) {
    super();
  }

  getRequestPhase = () => REQUEST_PHASE.POST_CONTROLLER;

  async apply(context: Context) {
    const request = context.getRequest();
    const response = context.getResponse();

    addAccessControlHeaders(request, response, this.corsConfigs);
  }
}
