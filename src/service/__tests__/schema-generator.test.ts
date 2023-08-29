import path from "path";

import { EventManager } from "@alliage/lifecycle";

import { MetadataManager } from "../../service/metadata-manager";
import { Config as OpenApiSpecs } from "../../config/openapi-specs";
import {
  RestAPIPostGenerateSchemaEvent,
  RestAPIPreGenerateSchemaEvent,
  REST_API_EVENTS,
} from "../../events";
import { SchemaGenerator } from "../schema-generator";

describe("service/schema-generator", () => {
  describe("SchemaMiddleware", () => {
    const metadataManager = new MetadataManager(
      "production",
      [
        path.resolve(
          `${__dirname}/../../__tests__/fixtures/controllers/test*.ts`
        ),
      ],
      `/tmp/${path.basename(__filename)}.metadata.json`,
      false,
      path.resolve(`${__dirname}/../../__tests__/fixtures/tsconfig.json`)
    );
    const openApiSpecs: OpenApiSpecs = {
      openapi: "3.0.0",
      info: {
        title: "Alliage",
        version: "1.0.0",
      },
      paths: {},
    };
    const eventManager = new EventManager();
    const schemaGenerator = new SchemaGenerator(
      eventManager,
      metadataManager,
      openApiSpecs
    );

    describe("#loadMetadata", () => {
      it("should load the metadata from the MetadataManager", async () => {
        const loadMetadataSpy = jest
          .spyOn(metadataManager, "loadMetadata")
          .mockResolvedValueOnce(undefined);

        await schemaGenerator.loadMetadata();

        expect(loadMetadataSpy).toHaveBeenCalled();
        loadMetadataSpy.mockRestore();
      });
    });

    describe("#getSchema", () => {
      beforeAll(async () => {
        await metadataManager.generateMetadata();
        await metadataManager.loadMetadata();
      });

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should return the schema", async () => {
        expect(await schemaGenerator.getSchema()).toEqual({
          info: {
            title: "Alliage",
            version: "1.0.0",
          },
          openapi: "3.0.0",
          paths: {
            "/api/check-age": {
              post: {
                description: "Test1 Controller description",
                operationId: "checkAge",
                parameters: [
                  {
                    name: "country",
                    in: "query",
                    required: true,
                    schema: {
                      type: "string",
                    },
                  },
                ],
                requestBody: {
                  content: {
                    ["application/json"]: {
                      schema: {
                        additionalProperties: false,
                        properties: {
                          age: {
                            type: "number",
                          },
                        },
                        required: ["age"],
                        type: "object",
                      },
                    },
                  },
                  required: true,
                },
                responses: {
                  "200": {
                    content: {
                      "application/json": {
                        schema: {
                          additionalProperties: false,
                          properties: {
                            message: {
                              type: "string",
                            },
                          },
                          required: ["message"],
                          type: "object",
                        },
                      },
                    },
                    description: "Test1 Controller return description",
                  },
                  "400": {
                    content: {
                      "application/json": {
                        schema: {
                          additionalProperties: false,
                          properties: {
                            message: {
                              type: "string",
                            },
                            minimumAge: {
                              type: "number",
                            },
                          },
                          required: ["message", "minimumAge"],
                          type: "object",
                        },
                      },
                    },
                    description: "Error raised when the user is not an adult",
                  },
                },
              },
            },
            "/api/hello/{name}": {
              get: {
                description: "Test2 Controller description",
                operationId: "sayHello",
                parameters: [
                  {
                    name: "name",
                    in: "path",
                    required: true,
                    schema: {
                      pattern: "[a-zA-Z]+",
                      type: "string",
                    },
                  },
                  {
                    name: "language",
                    in: "query",
                    required: false,
                    schema: {
                      enum: ["fr", "en"],
                      type: "string",
                    },
                  },
                ],
                requestBody: undefined,
                responses: {
                  "200": {
                    content: {
                      "application/json": {
                        schema: {
                          additionalProperties: false,
                          properties: {
                            message: {
                              type: "string",
                            },
                          },
                          required: ["message"],
                          type: "object",
                        },
                      },
                    },
                    description: "Test2 Controller return description",
                  },
                  "400": {
                    content: {
                      "application/json": {
                        schema: {
                          additionalProperties: false,
                          properties: {
                            message: {
                              type: "string",
                            },
                          },
                          required: ["message"],
                          type: "object",
                        },
                      },
                    },
                    description:
                      "Error raised when the user requested French language",
                  },
                },
              },
            },
            "/api/hierarchy": {
              post: {
                description: undefined,
                operationId: "getHierarchyDetails",
                parameters: [],
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        additionalProperties: false,
                        properties: {
                          employees: {
                            items: {
                              additionalProperties: false,
                              properties: {
                                directReports: {
                                  items: {
                                    $ref: "#/paths/~1api~1hierarchy/post/requestBody/content/application~1json/schema/properties/employees/items",
                                  },
                                  type: "array",
                                },
                                name: {
                                  type: "string",
                                },
                              },
                              required: ["name", "directReports"],
                              type: "object",
                            },
                            type: "array",
                          },
                        },
                        required: ["employees"],
                        type: "object",
                      },
                    },
                  },
                  required: true,
                },
                responses: {
                  "204": {
                    content: undefined,
                    description: "Success response",
                  },
                  "401": {
                    content: undefined,
                    description: "401 Error",
                  },
                },
              },
            },
          },
        });
      });

      describe("Events", () => {
        const eventsSchemaGenerator = new SchemaGenerator(
          eventManager,
          metadataManager,
          openApiSpecs
        );

        const preGenerateSchemaEventHandler = jest.fn();
        const postGenerateSchemaEventHandler = jest.fn();
        eventManager.on(
          REST_API_EVENTS.PRE_GENERATE_SCHEMA,
          preGenerateSchemaEventHandler
        );
        eventManager.on(
          REST_API_EVENTS.POST_GENERATE_SCHEMA,
          postGenerateSchemaEventHandler
        );

        it("should trigger events and take their modification in account when generating the schema", async () => {
          eventManager.on(
            REST_API_EVENTS.PRE_GENERATE_SCHEMA,
            (event: RestAPIPreGenerateSchemaEvent) => {
              expect(event.getMetadata()).toEqual({
                get: [
                  {
                    actionMetadata: {
                      bodyType: {},
                      controllerName: "Test2Controller",
                      defaultStatusCode: 200,
                      description: "Test2 Controller description",
                      returnDescription: "Test2 Controller return description",
                      errors: [
                        {
                          code: "400",
                          description:
                            "Error raised when the user requested French language",
                          payloadType: {
                            additionalProperties: false,
                            properties: {
                              message: {
                                type: "string",
                              },
                            },
                            required: ["message"],
                            type: "object",
                          },
                        },
                      ],
                      name: "sayHello",
                      paramsType: {
                        additionalProperties: false,
                        properties: {
                          name: {
                            pattern: "[a-zA-Z]+",
                            type: "string",
                          },
                        },
                        required: ["name"],
                        type: "object",
                      },
                      queryType: {
                        additionalProperties: false,
                        properties: {
                          language: {
                            enum: ["fr", "en"],
                            type: "string",
                          },
                        },
                        type: "object",
                      },
                      returnType: {
                        additionalProperties: false,
                        properties: {
                          message: {
                            type: "string",
                          },
                        },
                        required: ["message"],
                        type: "object",
                      },
                      validateInput: true,
                      validateOutput: true,
                    },
                    path: "/api/hello/{name}",
                    pattern:
                      "/^\\/api\\/hello(?:\\/([^\\/#\\?]+?))[\\/#\\?]?$/i",
                  },
                ],
                post: [
                  {
                    actionMetadata: {
                      bodyType: {
                        additionalProperties: false,
                        properties: {
                          age: {
                            type: "number",
                          },
                        },
                        required: ["age"],
                        type: "object",
                      },
                      controllerName: "Test1Controller",
                      defaultStatusCode: 200,
                      description: "Test1 Controller description",
                      returnDescription: "Test1 Controller return description",
                      errors: [
                        {
                          code: "400",
                          description:
                            "Error raised when the user is not an adult",
                          payloadType: {
                            additionalProperties: false,
                            properties: {
                              message: {
                                type: "string",
                              },
                              minimumAge: {
                                type: "number",
                              },
                            },
                            required: ["message", "minimumAge"],
                            type: "object",
                          },
                        },
                      ],
                      name: "checkAge",
                      paramsType: {},
                      queryType: {
                        additionalProperties: false,
                        properties: {
                          country: {
                            type: "string",
                          },
                        },
                        required: ["country"],
                        type: "object",
                      },
                      returnType: {
                        additionalProperties: false,
                        properties: {
                          message: {
                            type: "string",
                          },
                        },
                        required: ["message"],
                        type: "object",
                      },
                      validateInput: true,
                      validateOutput: true,
                    },
                    path: "/api/check-age",
                    pattern: "/^\\/api\\/check-age[\\/#\\?]?$/i",
                  },
                  {
                    actionMetadata: {
                      bodyType: {
                        additionalProperties: false,
                        properties: {
                          employees: {
                            items: {
                              additionalProperties: false,
                              properties: {
                                directReports: {
                                  items: {
                                    $ref: "#/properties/employees/items",
                                  },
                                  type: "array",
                                },
                                name: {
                                  type: "string",
                                },
                              },
                              required: ["name", "directReports"],
                              type: "object",
                            },
                            type: "array",
                          },
                        },
                        required: ["employees"],
                        type: "object",
                      },
                      controllerName: "Test3Controller",
                      defaultStatusCode: 204,
                      errors: [
                        {
                          code: "401",
                          payloadType: {
                            type: "null",
                          },
                        },
                      ],
                      name: "getHierarchy",
                      operationId: "getHierarchyDetails",
                      paramsType: {
                        type: "null",
                      },
                      queryType: {
                        type: "null",
                      },
                      returnType: {
                        type: "null",
                      },
                      validateInput: true,
                      validateOutput: true,
                    },
                    path: "/api/hierarchy",
                    pattern: "/^\\/api\\/hierarchy[\\/#\\?]?$/i",
                  },
                ],
              });
              event.setMetadata({
                get: [
                  {
                    actionMetadata: {
                      bodyType: {},
                      controllerName: "TestXController",
                      defaultStatusCode: 200,
                      errors: [],
                      name: "actionY",
                      operationId: undefined,
                      paramsType: {},
                      queryType: {},
                      returnType: {
                        additionalProperties: false,
                        properties: {
                          message: {
                            type: "string",
                          },
                        },
                        required: ["message"],
                        type: "object",
                      },
                      validateInput: true,
                      validateOutput: true,
                      description: "TestX Controller description",
                      returnDescription: "TestX Controller return description",
                    },
                    path: "/api/x/y",
                    pattern: "/^\\/api\\/x\\/y$/i",
                  },
                ],
              });
            }
          );

          eventManager.on(
            REST_API_EVENTS.POST_GENERATE_SCHEMA,
            (event: RestAPIPostGenerateSchemaEvent) => {
              expect(event.getMetadata()).toEqual({
                get: [
                  {
                    actionMetadata: {
                      bodyType: {},
                      controllerName: "TestXController",
                      defaultStatusCode: 200,
                      description: "TestX Controller description",
                      returnDescription: "TestX Controller return description",
                      errors: [],
                      name: "actionY",
                      paramsType: {},
                      queryType: {},
                      returnType: {
                        additionalProperties: false,
                        properties: {
                          message: {
                            type: "string",
                          },
                        },
                        required: ["message"],
                        type: "object",
                      },
                      validateInput: true,
                      validateOutput: true,
                    },
                    path: "/api/x/y",
                    pattern: "/^\\/api\\/x\\/y$/i",
                  },
                ],
              });
              expect(event.getSchema()).toEqual({
                info: {
                  title: "Alliage",
                  version: "1.0.0",
                },
                openapi: "3.0.0",
                paths: {
                  "/api/x/y": {
                    get: {
                      description: "TestX Controller description",
                      operationId: "actionY",
                      parameters: [],
                      requestBody: undefined,
                      responses: {
                        "200": {
                          content: {
                            "application/json": {
                              schema: {
                                additionalProperties: false,
                                properties: {
                                  message: {
                                    type: "string",
                                  },
                                },
                                required: ["message"],
                                type: "object",
                              },
                            },
                          },
                          description: "TestX Controller return description",
                        },
                      },
                    },
                  },
                },
              });
              event.setSchema({
                ...event.getSchema(),
                info: {
                  title: "Alliage (modified)",
                  version: "2.0.0",
                },
              });
            }
          );

          const schema = await eventsSchemaGenerator.getSchema();

          expect(preGenerateSchemaEventHandler).toHaveBeenCalled();
          expect(postGenerateSchemaEventHandler).toHaveBeenCalled();
          expect(schema).toEqual({
            info: {
              title: "Alliage (modified)",
              version: "2.0.0",
            },
            openapi: "3.0.0",
            paths: {
              "/api/x/y": {
                get: {
                  description: "TestX Controller description",
                  operationId: "actionY",
                  parameters: [],
                  requestBody: undefined,
                  responses: {
                    "200": {
                      content: {
                        "application/json": {
                          schema: {
                            additionalProperties: false,
                            properties: {
                              message: {
                                type: "string",
                              },
                            },
                            required: ["message"],
                            type: "object",
                          },
                        },
                      },
                      description: "TestX Controller return description",
                    },
                  },
                },
              },
            },
          });
        });

        it("should not re-generate the schema everytime", async () => {
          await eventsSchemaGenerator.getSchema();

          expect(preGenerateSchemaEventHandler).not.toHaveBeenCalled();
          expect(postGenerateSchemaEventHandler).not.toHaveBeenCalled();
        });
      });
    });
  });
});
