import { REQUEST_PHASE, AbstractMiddleware, Context } from "@alliage/webserver";
import { EventManager } from "@alliage/lifecycle";

import {
  RestAPIPostGenerateSchemaEvent,
  RestAPIPreGenerateSchemaEvent,
} from "../events";
import { Config as OpenApiSpecs } from "../config/openapi-specs";
import { Config } from "../config/main";
import { MetadataManager } from "../service/metadata-manager";

/**
 * Exposes the OpenAPI schema endpoint
 */
export class SchemaMiddleware extends AbstractMiddleware {
  private schema: OpenApiSpecs | undefined;

  constructor(
    private metadataManager: MetadataManager,
    private openApiSpecs: OpenApiSpecs,
    private schemaConfig: Config["schema"],
    private eventManager: EventManager
  ) {
    super();
  }

  getRequestPhase = () => REQUEST_PHASE.PRE_CONTROLLER;

  /**
   * Generates the OpenAPI schema
   * @returns OpenAPI schema
   */
  private async generateSchema() {
    if (this.schema) {
      return this.schema;
    }

    const preEvent = new RestAPIPreGenerateSchemaEvent(
      this.metadataManager.getMetadata()
    );
    await this.eventManager.emit(preEvent.getType(), preEvent);

    const metadata = preEvent.getMetadata();

    const paths = Object.entries(metadata).reduce(
      (paths, [method, metadata]) => {
        return metadata.reduce((p, { path, actionMetadata }) => {
          const params = actionMetadata.paramsType;
          const query = actionMetadata.queryType;
          return {
            ...p,
            [path]: {
              ...(p as Record<string, object>)[path],
              [method.toLowerCase()]: {
                parameters: [
                  ...Object.entries(params.properties ?? {}).map(
                    ([name, schema]) => ({
                      name,
                      schema,
                      in: "path",
                      required: true,
                    })
                  ),
                  ...Object.entries(query.properties ?? {}).map(
                    ([name, schema]) => ({
                      name,
                      schema,
                      in: "query",
                      required: query.required?.includes(name) ?? false,
                    })
                  ),
                ],
                requestBody:
                  Object.entries(actionMetadata.bodyType).length > 0
                    ? {
                        required: true,
                        content: {
                          ["application/json"]: {
                            schema: actionMetadata.bodyType,
                          },
                        },
                      }
                    : undefined,
                responses: {
                  [actionMetadata.defaultStatusCode]: {
                    description: "Success response",
                    content: {
                      ["application/json"]: {
                        schema: actionMetadata.returnType,
                      },
                    },
                  },
                  ...actionMetadata.errors.reduce((responses, error) => {
                    return {
                      ...responses,
                      [error.code]: {
                        description: error.description,
                        content: {
                          ["application/json"]: {
                            schema: error.payloadType,
                          },
                        },
                      },
                    };
                  }, {}),
                },
              },
            },
          };
        }, paths);
      },
      {}
    );

    this.schema = {
      ...this.openApiSpecs,
      paths: {
        ...paths,
        ...(this.openApiSpecs.paths as object),
      },
    };

    const postEvent = new RestAPIPostGenerateSchemaEvent(metadata, this.schema);
    await this.eventManager.emit(postEvent.getType(), postEvent);
    return postEvent.getSchema();
  }

  async apply(context: Context) {
    const requestPath = context.getRequest().getPath();

    if (this.schemaConfig.enable && requestPath === this.schemaConfig.path) {
      const schema = await this.generateSchema();
      context.getResponse().setStatus(200).setBody(schema).end();
    }
  }
}
