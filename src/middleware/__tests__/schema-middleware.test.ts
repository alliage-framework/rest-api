import path from "path";

import { EventManager } from "@alliage/lifecycle";
import {
  REQUEST_PHASE,
  AbstractResponse,
  AbstractRequest,
  Context,
} from "@alliage/webserver";

import { MetadataManager } from "../../service/metadata-manager";
import { Config as OpenApiSpecs } from "../../config/openapi-specs";
import { SchemaMiddleware } from "../schema-middleware";
import {
  RestAPIPostGenerateSchemaEvent,
  RestAPIPreGenerateSchemaEvent,
  REST_API_EVENTS,
} from "../../events";

function createDummyResponse() {
  const response = {
    setStatus: jest.fn().mockImplementation(() => response),
    setBody: jest.fn().mockImplementation(() => response),
    end: jest.fn().mockImplementation(() => response),
  } as unknown as AbstractResponse;
  return response;
}

function createDummyRequest() {
  const request = {
    getPath: jest.fn(),
  } as unknown as AbstractRequest;
  return request;
}

describe("middleware/schema-middleware", () => {
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
    const middleware = new SchemaMiddleware(
      metadataManager,
      openApiSpecs,
      { enable: true, path: "/api/specs" },
      eventManager
    );

    describe("#getRequestPhase", () => {
      it("should apply before the controllers", () => {
        expect(middleware.getRequestPhase()).toBe(REQUEST_PHASE.PRE_CONTROLLER);
      });
    });

    describe("#apply", () => {
      const dummyRequest = createDummyRequest();
      const dummyResponse = createDummyResponse();
      const context = new Context(dummyRequest, dummyResponse, "express");

      beforeAll(async () => {
        await metadataManager.generateMetadata();
        await metadataManager.loadMetadata();
      });

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should return the schema", async () => {
        (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");
        await middleware.apply(context);

        expect(dummyResponse.setBody).toHaveBeenCalledWith({
          info: {
            title: "Alliage",
            version: "1.0.0",
          },
          openapi: "3.0.0",
          paths: {
            "/api/check-age": {
              post: {
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
                    description: "Success response",
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
                    description: "Success response",
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
          },
        });
        expect(dummyResponse.setStatus).toHaveBeenCalledWith(200);
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should not return the schema if the configuration disables it", async () => {
        (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");
        const disabledMiddleware = new SchemaMiddleware(
          metadataManager,
          openApiSpecs,
          // The schema is disabled
          { enable: false, path: "/api/specs" },
          eventManager
        );
        await disabledMiddleware.apply(context);

        expect(dummyResponse.setBody).not.toHaveBeenCalled();
        expect(dummyResponse.setStatus).not.toHaveBeenCalled();
        expect(dummyResponse.end).not.toHaveBeenCalled();
      });

      it("should not return the schema if the path doesn't match", async () => {
        (dummyRequest.getPath as jest.Mock).mockReturnValueOnce(
          "/api/other/path"
        );
        await middleware.apply(context);

        expect(dummyResponse.setBody).not.toHaveBeenCalled();
        expect(dummyResponse.setStatus).not.toHaveBeenCalled();
        expect(dummyResponse.end).not.toHaveBeenCalled();
      });

      describe("Events", () => {
        const eventsMiddleware = new SchemaMiddleware(
          metadataManager,
          openApiSpecs,
          { enable: true, path: "/api/specs" },
          eventManager
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
          (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");

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
                          description: "Success response",
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

          await eventsMiddleware.apply(context);

          expect(preGenerateSchemaEventHandler).toHaveBeenCalled();
          expect(postGenerateSchemaEventHandler).toHaveBeenCalled();
          expect(dummyResponse.setBody).toHaveBeenCalledWith({
            info: {
              title: "Alliage (modified)",
              version: "2.0.0",
            },
            openapi: "3.0.0",
            paths: {
              "/api/x/y": {
                get: {
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
                      description: "Success response",
                    },
                  },
                },
              },
            },
          });
        });

        it("should not re-generate the schema everytime", async () => {
          (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");

          await eventsMiddleware.apply(context);

          expect(preGenerateSchemaEventHandler).not.toHaveBeenCalled();
          expect(postGenerateSchemaEventHandler).not.toHaveBeenCalled();
        });
      });
    });
  });
});
