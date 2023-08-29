import { REQUEST_PHASE, AbstractMiddleware, Context } from "@alliage/webserver";

import { Config } from "../config/main";
import { SchemaGenerator } from "../service/schema-generator";

/**
 * Exposes the OpenAPI schema endpoint
 */
export class SchemaMiddleware extends AbstractMiddleware {
  constructor(
    private schemaGenerator: SchemaGenerator,
    private schemaConfig: Config["schema"]
  ) {
    super();
  }

  getRequestPhase = () => REQUEST_PHASE.PRE_CONTROLLER;

  async apply(context: Context) {
    const requestPath = context.getRequest().getPath();

    if (this.schemaConfig.enable && requestPath === this.schemaConfig.path) {
      const schema = await this.schemaGenerator.getSchema();
      context.getResponse().setStatus(200).setBody(schema).end();
    }
  }
}
