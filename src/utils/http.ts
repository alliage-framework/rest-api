import {
  AbstractRequest,
  AbstractResponse,
  HTTP_METHOD,
} from "@alliage/webserver";

import { Config } from "../config/main";

export function addAccessControlHeaders(
  request: AbstractRequest,
  response: AbstractResponse,
  corsConfigs: Config["allowedOrigins"]
) {
  const reqOrigin = request.getHeader("Origin");

  const originCorsConfig = corsConfigs?.find(
    ({ origin }) => origin === reqOrigin
  );

  if (originCorsConfig) {
    response.setHeader("Access-Control-Allow-Origin", originCorsConfig.origin);
    if (request.getMethod() === HTTP_METHOD.OPTIONS) {
      response.setHeader(
        "Access-Control-Allow-Headers",
        originCorsConfig.headers?.join(", ") ?? ""
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        originCorsConfig.methods?.join(", ") ?? ""
      );
      response.setHeader(
        "Access-Control-Max-Age",
        originCorsConfig.maxAge?.toString() ?? ""
      );
    }
  }
}
