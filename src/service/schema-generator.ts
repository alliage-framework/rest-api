import { EventManager } from "@alliage/lifecycle";

import { Config as OpenApiSpecs } from "../config/openapi-specs";
import {
  RestAPIPostGenerateSchemaEvent,
  RestAPIPreGenerateSchemaEvent,
} from "../events";

import { MetadataManager } from "./metadata-manager";

const REF_REGEXP = /^#(\/.*)$/;

export class SchemaGenerator {
  private schema: OpenApiSpecs | undefined;

  constructor(
    private eventManager: EventManager,
    private metadataManager: MetadataManager,
    private openApiSpecs: OpenApiSpecs
  ) {}

  public async loadMetadata() {
    await this.metadataManager.loadMetadata();
  }

  /**
   * Gets the OpenAPI schema from the metadata
   * @returns OpenAPI sche^ma
   */
  public async getSchema() {
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
                operationId: actionMetadata.operationId ?? actionMetadata.name,
                description: actionMetadata.description,
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
                    description:
                      actionMetadata.returnDescription ?? "Success response",
                    content:
                      actionMetadata.returnType &&
                      actionMetadata.returnType.type !== "null"
                        ? {
                            ["application/json"]: {
                              schema: actionMetadata.returnType,
                            },
                          }
                        : undefined,
                  },
                  ...actionMetadata.errors.reduce((responses, error) => {
                    return {
                      ...responses,
                      [error.code]: {
                        description: error.description ?? `${error.code} Error`,
                        content:
                          error.payloadType && error.payloadType.type !== "null"
                            ? {
                                ["application/json"]: {
                                  schema: error.payloadType,
                                },
                              }
                            : undefined,
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

    this.schema = this._resolveRefs({
      ...this.openApiSpecs,
      paths: {
        ...paths,
        ...(this.openApiSpecs.paths as object),
      },
    }) as OpenApiSpecs;

    const postEvent = new RestAPIPostGenerateSchemaEvent(metadata, this.schema);
    await this.eventManager.emit(postEvent.getType(), postEvent);
    return postEvent.getSchema();
  }

  private _resolveRefs(schema: unknown, path: string[] = []): unknown {
    if (Array.isArray(schema)) {
      return schema.map((item, index) =>
        this._resolveRefs(item, [...path, index.toString()])
      );
    }
    if (typeof schema === "object") {
      const schemaPos = path.indexOf("schema");
      return Object.entries(schema as object).reduce((acc, [key, value]) => {
        if (key === "$ref") {
          const match = REF_REGEXP.exec(value as string);
          value = `#/${path
            .slice(0, schemaPos + 1)
            .map((p) => p.replace(/~/g, "~0").replace(/\//g, "~1"))
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .join("/")}${match![1]}`;
        }
        return {
          ...acc,
          [key]: this._resolveRefs(value, [...path, key]),
        };
      }, {} as Record<string, unknown>);
    }

    return schema;
  }
}
