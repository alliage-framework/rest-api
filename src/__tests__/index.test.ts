import path from "path";
import fs from "fs";

import yaml from "js-yaml";
import { ConfigLoadEvent, CONFIG_EVENTS } from "@alliage/config-loader";
import { instanceOf, ServiceContainer } from "@alliage/di";
import {
  EventManager,
  INIT_EVENTS,
  LifeCycleInitEvent,
} from "@alliage/lifecycle";
import {
  AdapterPostControllerEvent,
  AdapterPreControllerEvent,
  AdapterPreRequestEvent,
  ADAPTER_EVENTS,
  AbstractRequest,
  AbstractResponse,
  Params,
  AbstractController,
} from "@alliage/webserver";
import { Arguments, INITIALIZATION_CONTEXT } from "@alliage/framework";

import AlliageRestAPIModule, { DumpSchemaProcess, SchemaGenerator } from "..";
import { ErrorMiddleware } from "../middleware/error-middleware";
import { JSONParserMiddleware } from "../middleware/json-parser-middleware";
import { SchemaMiddleware } from "../middleware/schema-middleware";
import { GenerateSchemaProcess } from "../process/generate-schema-process";
import { MetadataManager } from "../service/metadata-manager";
import { Validator } from "../service/validator";
import { GenerateSchemaTask } from "../task/generate-schema-task";
import { schema as openApiSchema } from "../config/openapi-specs";
import { schema as mainSchema, Config as MainConfig } from "../config/main";
import { HttpError } from "../error";
import {
  RestAPIInvalidRequestEvent,
  RestAPIInvalidResponseEvent,
  RestAPIPostValidateRequestEvent,
  RestAPIPreValidateRequestEvent,
  RestAPIPreValidateResponseEvent,
  REST_API_EVENTS,
} from "../events";
import { CORSMiddleware } from "../middleware/cors-middleware";

const METADATA_PATH = `/tmp/${path.basename(__filename)}.metadata.json`;
const DEFAULT_CONFIG = yaml.load(
  fs
    .readFileSync(path.resolve(__dirname, "../../base-files/main-config.yaml"))
    .toString()
) as MainConfig;

jest.mock("@alliage/di", () => {
  const module = jest.requireActual("@alliage/di");
  return {
    ...(module as any),
    parameter: (path: string) => ({ ...module.parameter(path), path }),
  };
});

jest.mock("@alliage/config-loader", () => ({
  ...(jest.requireActual("@alliage/config-loader") as any),
  validators: { jsonSchema: (schema: object) => schema },
}));

describe("rest-api", () => {
  describe("AlliageRestAPIModule", () => {
    const module = new AlliageRestAPIModule();

    describe("#getEventHandlers", () => {
      it("should listen to the load, post init, and all webserver events", () => {
        expect(module.getEventHandlers()).toEqual({
          [CONFIG_EVENTS.LOAD]: module.handleConfigLoadEvent,
          [INIT_EVENTS.POST_INIT]: module.handlePostInitEvent,
          [ADAPTER_EVENTS.PRE_REQUEST]: module.handlePreRequest,
          [ADAPTER_EVENTS.POST_CONTROLLER]: module.handlePostController,
          [ADAPTER_EVENTS.PRE_CONTROLLER]: module.handlePreController,
          [ADAPTER_EVENTS.SERVER_STARTED]: module.handleServerStarted,
        });
      });
    });

    describe("#registerServices", () => {
      const serviceContainer = new ServiceContainer();
      const registerServiceSpy = jest.spyOn(
        serviceContainer,
        "registerService"
      );

      beforeAll(() => {
        module.registerServices(serviceContainer);
      });

      it("should register the metadata manager", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-metadata-manager",
          MetadataManager,
          [
            expect.objectContaining({ path: "environment" }),
            expect.objectContaining({ path: "rest-api.metadata.sources" }),
            expect.objectContaining({ path: "rest-api.metadata.path" }),
            expect.objectContaining({
              path: "rest-api.development.disableMetadataGeneration",
            }),
          ]
        );
      });

      it("should register the schema generator", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-schema-generator",
          SchemaGenerator,
          [
            instanceOf(EventManager),
            instanceOf(MetadataManager),
            expect.objectContaining({
              path: "rest-api-openapi-specs",
            }),
          ]
        );
      });

      it("should register the validator", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-validator",
          Validator
        );
      });

      it("should register the json parser middleware", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-json-parser-middleware",
          JSONParserMiddleware
        );
      });

      it("should register the error middleware", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-error-middleware",
          ErrorMiddleware,
          [
            instanceOf(EventManager),
            expect.objectContaining({ path: "environment" }),
          ]
        );
      });

      it("should register the CORS middleware", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-cors-middleware",
          CORSMiddleware,
          [expect.objectContaining({ path: "rest-api.allowedOrigins" })]
        );
      });

      it("should register the schema middleware", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-schema-middleware",
          SchemaMiddleware,
          [
            instanceOf(SchemaGenerator),
            expect.objectContaining({ path: "rest-api.schema" }),
          ]
        );
      });

      it("should register the generate schema process", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-generate-schema-process",
          GenerateSchemaProcess,
          [instanceOf(MetadataManager)]
        );
      });

      it("should register the dump schema process", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-dump-schema-process",
          DumpSchemaProcess,
          [instanceOf(SchemaGenerator)]
        );
      });

      it("should register the generate schema task", () => {
        expect(registerServiceSpy).toHaveBeenCalledWith(
          "rest-generate-schema-task",
          GenerateSchemaTask,
          [instanceOf(MetadataManager)]
        );
      });
    });

    describe("#handleConfigLoadEvent", () => {
      const event = new ConfigLoadEvent();
      beforeAll(() => {
        module.handleConfigLoadEvent(event);
      });

      it("should load the main config file", () => {
        expect(event.getConfigs()).toContainEqual({
          fileName: "rest-api",
          validator: mainSchema,
        });
      });

      it("should load the openAPI specs config file", () => {
        expect(event.getConfigs()).toContainEqual({
          fileName: "rest-api-openapi-specs",
          validator: openApiSchema,
        });
      });
    });

    describe("Webserver event handlers", () => {
      async function createServicesAndModule({
        env = "production",
        sources = [] as string[],
        config = DEFAULT_CONFIG,
      } = {}) {
        const eventManager = new EventManager();
        const metadataManager = new MetadataManager(
          env,
          sources,
          METADATA_PATH,
          false,
          path.resolve(__dirname, "./fixtures/tsconfig.json")
        );
        const validator = new Validator();
        const serviceContainer = new ServiceContainer();

        serviceContainer.addService("rest-metadata-manager", metadataManager);
        serviceContainer.addService("rest-validator", validator);
        serviceContainer.addService("event_manager", eventManager);
        serviceContainer.setParameter("rest-api", config);

        const module = new AlliageRestAPIModule();

        await metadataManager.generateMetadata();
        await metadataManager.loadMetadata();
        module.handlePostInitEvent(
          new LifeCycleInitEvent(INIT_EVENTS.POST_INIT, {
            serviceContainer,
            env,
            args: Arguments.create(),
            context: INITIALIZATION_CONTEXT.RUN,
          })
        );
        return {
          services: {
            eventManager,
            metadataManager,
            validator,
            serviceContainer,
          },
          restApiModule: module,
        };
      }

      function createRequest({
        headers = {} as Record<string, string>,
        method = "GET",
        body = {} as any,
        params = {} as Params,
        query = {} as Params,
        path = "",
      } = {}) {
        return {
          getMethod: jest.fn().mockReturnValue(method),
          getHeader: jest
            .fn()
            .mockImplementation((name: string) => headers[name]),
          getBody: jest.fn().mockReturnValue(body),
          getQuery: jest.fn().mockReturnValue(query),
          getParams: jest.fn().mockReturnValue(params),
          getPath: jest.fn().mockReturnValue(path),
        } as unknown as AbstractRequest;
      }

      function createResponse({
        status = 200,
        headers = {} as Record<string, string>,
        body = undefined as any,
      } = {}) {
        return {
          setStatus: jest.fn(),
          setHeader: jest.fn(),
          setBody: jest.fn(),
          getStatus: jest.fn().mockReturnValue(status),
          getHeader: jest
            .fn()
            .mockImplementation((name: string) => headers[name]),
          getBody: jest.fn().mockReturnValue(body),
          end: jest.fn(),
        } as unknown as AbstractResponse;
      }

      describe("#handleServerStarted", () => {
        it("should load the metadata", async () => {
          const { restApiModule, services } = await createServicesAndModule();

          const loadMetadataSpy = jest
            .spyOn(services.metadataManager, "loadMetadata")
            .mockResolvedValue();

          await restApiModule.handleServerStarted();

          expect(loadMetadataSpy).toHaveBeenCalled();
        });
      });

      describe("#handlePreRequest", () => {
        it("should add the access control headers and return a 204 status code when the method is OPTION and a CORS config is defined", async () => {
          const { restApiModule } = await createServicesAndModule({
            config: {
              ...DEFAULT_CONFIG,
              allowedOrigins: [
                {
                  origin: "https://acme.com",
                  headers: ["X-Custom-Header1", "X-Custom-Header2"],
                  methods: ["POST", "PUT"],
                  maxAge: 4800,
                },
              ],
            },
          });
          const request = createRequest({
            method: "OPTIONS",
            headers: {
              Origin: "https://acme.com",
              "Access-Control-Request-Method": "",
              "Access-Control-Request-Headers": "",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).toHaveBeenCalledWith(204);
          expect(response.end).toHaveBeenCalled();
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Origin",
            "https://acme.com"
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Headers",
            "X-Custom-Header1, X-Custom-Header2"
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Methods",
            "POST, PUT"
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Max-Age",
            "4800"
          );
        });

        it("should return empty values for CORS config properties that are not defined", async () => {
          const { restApiModule } = await createServicesAndModule({
            config: {
              ...DEFAULT_CONFIG,
              allowedOrigins: [
                {
                  origin: "https://acme.com",
                },
              ],
            },
          });
          const request = createRequest({
            method: "OPTIONS",
            headers: {
              Origin: "https://acme.com",
              "Access-Control-Request-Method": "",
              "Access-Control-Request-Headers": "",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).toHaveBeenCalledWith(204);
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Origin",
            "https://acme.com"
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Headers",
            ""
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Allow-Methods",
            ""
          );
          expect(response.setHeader).toHaveBeenCalledWith(
            "Access-Control-Max-Age",
            ""
          );
        });

        it("should do nothing if there's no CORS config at all", async () => {
          const { restApiModule } = await createServicesAndModule();
          const request = createRequest({
            method: "OPTIONS",
            headers: {
              Origin: "https://acme.com",
              "Access-Control-Request-Method": "",
              "Access-Control-Request-Headers": "",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).not.toHaveBeenCalled();
          expect(response.setHeader).not.toHaveBeenCalled();
        });

        it("should do nothing if there's no origin header in the request", async () => {
          const { restApiModule } = await createServicesAndModule({
            config: {
              ...DEFAULT_CONFIG,
              allowedOrigins: [
                {
                  origin: "https://acme.com",
                  headers: ["X-Custom-Header1", "X-Custom-Header2"],
                  methods: ["POST", "PUT"],
                  maxAge: 4800,
                },
              ],
            },
          });
          const request = createRequest({
            method: "OPTIONS",
            headers: {
              "Access-Control-Request-Method": "",
              "Access-Control-Request-Headers": "",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).not.toHaveBeenCalled();
          expect(response.setHeader).not.toHaveBeenCalled();
        });

        it("should do nothing if the request's method is not OPTIONS", async () => {
          const { restApiModule } = await createServicesAndModule({
            config: {
              ...DEFAULT_CONFIG,
              allowedOrigins: [
                {
                  origin: "https://acme.com",
                  headers: ["X-Custom-Header1", "X-Custom-Header2"],
                  methods: ["POST", "PUT"],
                  maxAge: 4800,
                },
              ],
            },
          });
          const request = createRequest({
            method: "POST",
            headers: {
              Origin: "https://acme.com",
              "Access-Control-Request-Method": "",
              "Access-Control-Request-Headers": "",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).not.toHaveBeenCalled();
          expect(response.setHeader).not.toHaveBeenCalled();
        });

        it("should do nothing if the request doesn't have any access control headers at all", async () => {
          const { restApiModule } = await createServicesAndModule({
            config: {
              ...DEFAULT_CONFIG,
              allowedOrigins: [
                {
                  origin: "https://acme.com",
                  headers: ["X-Custom-Header1", "X-Custom-Header2"],
                  methods: ["POST", "PUT"],
                  maxAge: 4800,
                },
              ],
            },
          });
          const request = createRequest({
            method: "OPTIONS",
            headers: {
              Origin: "https://acme.com",
            },
          });
          const response = createResponse();

          await restApiModule.handlePreRequest(
            new AdapterPreRequestEvent(request, response, "express")
          );

          expect(response.setStatus).not.toHaveBeenCalled();
          expect(response.setHeader).not.toHaveBeenCalled();
        });
      });

      describe("#handlePreController", () => {
        it("should send an error if the request is not valid", async () => {
          const {
            restApiModule,
            services: { eventManager, metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              // This part of the request is not valid
              age: "dix-huit",
            },
            query: {
              country: "USA",
            },
          });
          const response = createResponse();

          const expectedMetadata = metadataManager.findMetadata(
            "POST",
            "/api/check-age"
          );

          const preValidateRequestHandler = jest.fn(
            (e: RestAPIPreValidateRequestEvent) => {
              expect(e.getType()).toEqual(REST_API_EVENTS.PRE_VALIDATE_REQUEST);
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getRequest()).toBe(request);
            }
          );
          const invalidRequestHandler = jest.fn(
            (e: RestAPIInvalidRequestEvent) => {
              expect(e.getType()).toEqual(REST_API_EVENTS.INVALID_REQUEST);
              expect(e.getErrors()).toEqual([
                {
                  errors: [
                    {
                      instancePath: "/age",
                      keyword: "type",
                      message: "must be number",
                      params: {
                        type: "number",
                      },
                      schemaPath: "#/properties/age/type",
                    },
                  ],
                  source: "body",
                },
              ]);
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getRequest()).toBe(request);
            }
          );
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_REQUEST,
            preValidateRequestHandler
          );
          eventManager.on(
            REST_API_EVENTS.INVALID_REQUEST,
            invalidRequestHandler
          );

          try {
            await restApiModule.handlePreController(
              new AdapterPreControllerEvent(
                {} as AbstractController,
                () => undefined,
                request,
                response,
                [],
                "express"
              )
            );
            throw new Error("Didn't throw error");
          } catch (e) {
            if (!(e instanceof HttpError)) {
              throw e;
            }
            const error = e as HttpError<number, unknown>;
            expect(error.getData()).toEqual({
              code: 400,
              payload: [
                {
                  errors: [
                    {
                      instancePath: "/age",
                      keyword: "type",
                      message: "must be number",
                      params: {
                        type: "number",
                      },
                      schemaPath: "#/properties/age/type",
                    },
                  ],
                  source: "body",
                },
              ],
            });
          }

          expect(preValidateRequestHandler).toHaveBeenCalledTimes(1);
          expect(invalidRequestHandler).toHaveBeenCalledTimes(1);
        });

        it("should not send an error if the request is valid", async () => {
          const {
            restApiModule,
            services: { eventManager, metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: "18",
            },
            query: {
              country: "USA",
            },
          });
          const response = createResponse();

          const expectedMetadata = metadataManager.findMetadata(
            "POST",
            "/api/check-age"
          );

          const preValidateRequestHandler = jest.fn(
            (e: RestAPIPreValidateRequestEvent) => {
              expect(e.getType()).toEqual(REST_API_EVENTS.PRE_VALIDATE_REQUEST);
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getRequest()).toBe(request);
            }
          );
          const postValidateRequestHandler = jest.fn(
            (e: RestAPIPostValidateRequestEvent) => {
              expect(e.getType()).toEqual(
                REST_API_EVENTS.POST_VALIDATE_REQUEST
              );
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getRequest()).toBe(request);
            }
          );
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_REQUEST,
            preValidateRequestHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_REQUEST,
            postValidateRequestHandler
          );

          await restApiModule.handlePreController(
            new AdapterPreControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              [],
              "express"
            )
          );

          expect(preValidateRequestHandler).toHaveBeenCalledTimes(1);
          expect(postValidateRequestHandler).toHaveBeenCalledTimes(1);
        });

        it("should do nothing if the request validation is disabled in the config", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                requests: {
                  ...DEFAULT_CONFIG.validation.requests,
                  enable: false,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: "18",
            },
            query: {
              country: "USA",
            },
          });
          const response = createResponse();

          const preValidateRequestHandler = jest.fn();
          const postValidateRequestHandler = jest.fn();

          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_REQUEST,
            preValidateRequestHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_REQUEST,
            postValidateRequestHandler
          );

          await restApiModule.handlePreController(
            new AdapterPreControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              [],
              "express"
            )
          );

          expect(preValidateRequestHandler).not.toHaveBeenCalled();
          expect(postValidateRequestHandler).not.toHaveBeenCalled();
        });

        it("should do nothing if there are no metadata for the given request", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [],
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: "18",
            },
            query: {
              country: "USA",
            },
          });
          const response = createResponse();

          const preValidateRequestHandler = jest.fn();
          const postValidateRequestHandler = jest.fn();

          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_REQUEST,
            preValidateRequestHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_REQUEST,
            postValidateRequestHandler
          );

          await restApiModule.handlePreController(
            new AdapterPreControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              [],
              "express"
            )
          );

          expect(preValidateRequestHandler).not.toHaveBeenCalled();
          expect(postValidateRequestHandler).not.toHaveBeenCalled();
        });

        it("should do nothing if the validation is disabled in the controller", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/validation-metadata-controller.ts"
              ),
            ],
          });
          const request = createRequest({
            path: "/api/get-action",
            method: "GET",
          });
          const response = createResponse();

          const preValidateRequestHandler = jest.fn();
          const postValidateRequestHandler = jest.fn();

          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_REQUEST,
            preValidateRequestHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_REQUEST,
            postValidateRequestHandler
          );

          await restApiModule.handlePreController(
            new AdapterPreControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              [],
              "express"
            )
          );

          expect(preValidateRequestHandler).not.toHaveBeenCalled();
          expect(postValidateRequestHandler).not.toHaveBeenCalled();
        });
      });

      describe("#handlePostController", () => {
        it("should send an error if the response is not valid", async () => {
          const {
            restApiModule,
            services: { eventManager, metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  errors: {
                    returnErrors: true,
                    statusCode: 500,
                  },
                  enable: true,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const invalidBody = { invalid: "body" };

          const response = createResponse({ body: invalidBody });

          const expectedMetadata = metadataManager.findMetadata(
            "POST",
            "/api/check-age"
          );
          const expectedErrors = [
            {
              errors: [
                {
                  instancePath: "",
                  keyword: "required",
                  message: "must have required property 'message'",
                  params: {
                    missingProperty: "message",
                  },
                  schemaPath: "#/required",
                },
                {
                  instancePath: "",
                  keyword: "additionalProperties",
                  message: "must NOT have additional properties",
                  params: {
                    additionalProperty: "invalid",
                  },
                  schemaPath: "#/additionalProperties",
                },
              ],
              source: "body",
            },
          ];

          const preValidateResponseHandler = jest.fn(
            (e: RestAPIPreValidateResponseEvent) => {
              expect(e.getType()).toEqual(
                REST_API_EVENTS.PRE_VALIDATE_RESPONSE
              );
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          const invalidResponseHandler = jest.fn(
            (e: RestAPIInvalidResponseEvent) => {
              expect(e.getType()).toEqual(REST_API_EVENTS.INVALID_RESPONSE);
              expect(e.getErrors()).toEqual(expectedErrors);
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.INVALID_RESPONSE,
            invalidResponseHandler
          );

          try {
            await restApiModule.handlePostController(
              new AdapterPostControllerEvent(
                {} as AbstractController,
                () => undefined,
                request,
                response,
                invalidBody,
                "express"
              )
            );
            throw new Error("Didn't throw error");
          } catch (e) {
            if (!(e instanceof HttpError)) {
              throw e;
            }
            const error = e as HttpError<number, unknown>;
            expect(error.getData()).toEqual({
              code: 500,
              payload: expectedErrors,
            });
          }

          expect(preValidateResponseHandler).toHaveBeenCalledTimes(1);
          expect(invalidResponseHandler).toHaveBeenCalledTimes(1);
        });

        it("should not send an error if the response is valid", async () => {
          const {
            restApiModule,
            services: { eventManager, metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  errors: {
                    returnErrors: true,
                    statusCode: 500,
                  },
                  enable: true,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const validBody = { message: "test" };

          const response = createResponse({ body: validBody });

          const expectedMetadata = metadataManager.findMetadata(
            "POST",
            "/api/check-age"
          );

          const preValidateResponseHandler = jest.fn(
            (e: RestAPIPreValidateResponseEvent) => {
              expect(e.getType()).toEqual(
                REST_API_EVENTS.PRE_VALIDATE_RESPONSE
              );
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          const postValidateResponseHandler = jest.fn(
            (e: RestAPIInvalidResponseEvent) => {
              expect(e.getType()).toEqual(
                REST_API_EVENTS.POST_VALIDATE_RESPONSE
              );
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_RESPONSE,
            postValidateResponseHandler
          );

          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              validBody,
              "express"
            )
          );

          expect(response.setBody).toHaveBeenCalledWith(validBody);
          expect(response.setStatus).toHaveBeenCalledWith(200);
          expect(preValidateResponseHandler).toHaveBeenCalledTimes(1);
          expect(postValidateResponseHandler).toHaveBeenCalledTimes(1);
        });

        it("should not send error in case of invalid request if it's disabled in the config", async () => {
          const {
            restApiModule,
            services: { eventManager, metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  errors: {
                    returnErrors: false,
                    statusCode: 500,
                  },
                  enable: true,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const invalidBody = { invalid: "body" };

          const response = createResponse({ body: invalidBody });

          const expectedMetadata = metadataManager.findMetadata(
            "POST",
            "/api/check-age"
          );
          const expectedErrors = [
            {
              errors: [
                {
                  instancePath: "",
                  keyword: "required",
                  message: "must have required property 'message'",
                  params: {
                    missingProperty: "message",
                  },
                  schemaPath: "#/required",
                },
                {
                  instancePath: "",
                  keyword: "additionalProperties",
                  message: "must NOT have additional properties",
                  params: {
                    additionalProperty: "invalid",
                  },
                  schemaPath: "#/additionalProperties",
                },
              ],
              source: "body",
            },
          ];

          const preValidateResponseHandler = jest.fn(
            (e: RestAPIPreValidateResponseEvent) => {
              expect(e.getType()).toEqual(
                REST_API_EVENTS.PRE_VALIDATE_RESPONSE
              );
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          const invalidResponseHandler = jest.fn(
            (e: RestAPIInvalidResponseEvent) => {
              expect(e.getType()).toEqual(REST_API_EVENTS.INVALID_RESPONSE);
              expect(e.getErrors()).toEqual(expectedErrors);
              expect(e.getMetadata()).toEqual(expectedMetadata);
              expect(e.getResponse()).toBe(response);
            }
          );
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.INVALID_RESPONSE,
            invalidResponseHandler
          );

          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              invalidBody,
              "express"
            )
          );

          expect(preValidateResponseHandler).toHaveBeenCalledTimes(1);
          expect(invalidResponseHandler).toHaveBeenCalledTimes(1);
        });

        it("should not validate the response if there's not metadata for the given request", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  errors: {
                    returnErrors: true,
                    statusCode: 500,
                  },
                  enable: true,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const validBody = { message: "test" };

          const response = createResponse({ body: validBody });

          const preValidateResponseHandler = jest.fn();
          const postValidateResponseHandler = jest.fn();
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_RESPONSE,
            postValidateResponseHandler
          );

          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              validBody,
              "express"
            )
          );

          expect(response.setBody).toHaveBeenCalledWith(validBody);
          expect(response.setStatus).not.toHaveBeenCalled();
          expect(preValidateResponseHandler).not.toHaveBeenCalled();
          expect(postValidateResponseHandler).not.toHaveBeenCalled();
        });

        it("should not validate the response if it's disabled in the config", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  ...DEFAULT_CONFIG.validation.responses,
                  enable: false,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const validBody = { message: "test" };

          const response = createResponse({ body: validBody });

          const preValidateResponseHandler = jest.fn();
          const postValidateResponseHandler = jest.fn();
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_RESPONSE,
            postValidateResponseHandler
          );

          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              validBody,
              "express"
            )
          );

          expect(response.setBody).toHaveBeenCalledWith(validBody);
          expect(response.setStatus).toHaveBeenCalledWith(200);
          expect(preValidateResponseHandler).not.toHaveBeenCalled();
          expect(postValidateResponseHandler).not.toHaveBeenCalled();
        });

        it("should not validate the response if it's disabled in the controller", async () => {
          const {
            restApiModule,
            services: { eventManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/validation-metadata-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  errors: {
                    returnErrors: true,
                    statusCode: 500,
                  },
                  enable: true,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/post-action",
            method: "POST",
          });
          const response = createResponse();

          const preValidateResponseHandler = jest.fn();
          const postValidateResponseHandler = jest.fn();
          eventManager.on(
            REST_API_EVENTS.PRE_VALIDATE_RESPONSE,
            preValidateResponseHandler
          );
          eventManager.on(
            REST_API_EVENTS.POST_VALIDATE_RESPONSE,
            postValidateResponseHandler
          );

          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              undefined,
              "express"
            )
          );

          expect(preValidateResponseHandler).not.toHaveBeenCalled();
          expect(postValidateResponseHandler).not.toHaveBeenCalled();
        });
      });

      describe("#getRequestMetadata", () => {
        it("should not fetch metadata twice for the same request", async () => {
          const {
            restApiModule,
            services: { metadataManager },
          } = await createServicesAndModule({
            sources: [
              path.resolve(
                __dirname,
                "./fixtures/controllers/test1-controller.ts"
              ),
            ],
            config: {
              ...DEFAULT_CONFIG,
              validation: {
                ...DEFAULT_CONFIG.validation,
                responses: {
                  ...DEFAULT_CONFIG.validation.responses,
                  enable: false,
                },
              },
            },
          });
          const request = createRequest({
            path: "/api/check-age",
            method: "POST",
            body: {
              age: 18,
            },
            query: {
              country: "USA",
            },
          });
          const body = { message: "test" };
          const response = createResponse({ body });

          const findMetadataSpy = jest.spyOn(metadataManager, "findMetadata");

          await restApiModule.handlePreController(
            new AdapterPreControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              [],
              "express"
            )
          );
          await restApiModule.handlePostController(
            new AdapterPostControllerEvent(
              {} as AbstractController,
              () => undefined,
              request,
              response,
              body,
              "express"
            )
          );

          expect(findMetadataSpy).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
