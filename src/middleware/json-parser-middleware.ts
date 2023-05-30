import { REQUEST_PHASE, AbstractMiddleware, Context } from "@alliage/webserver";

import { createHttpError } from "../error";

/**
 * Transforms JSON string in the request body in an actual javascript object
 */
export class JSONParserMiddleware extends AbstractMiddleware {
  getRequestPhase = () => REQUEST_PHASE.PRE_CONTROLLER;

  async apply(context: Context) {
    const request = context.getRequest();
    if (request.getHeader("Content-Type") === "application/json") {
      let content = "";
      const stream = request.getReadableStream();
      stream.on("data", (data) => (content += data));
      await new Promise((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      try {
        const jsonObject = JSON.parse(content);
        request.setBody(jsonObject);
      } catch (error) {
        throw createHttpError(400, {
          message: "Invalid JSON",
        });
      }
    }
  }
}
