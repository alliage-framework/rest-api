import { AbstractRequest, AbstractResponse } from "@alliage/webserver";

import { ActionMetadata } from "../metadata-manager";
import { Validator } from "../validator";

function createDummyResponse() {
  const response = {
    getBody: jest.fn(),
  } as unknown as AbstractResponse;
  return response;
}

function createDummyRequest() {
  const request = {
    getBody: jest.fn(),
    getQuery: jest.fn(),
    getParams: jest.fn(),
  } as unknown as AbstractRequest;
  return request;
}

const BASE_ACTION_METADATA: ActionMetadata = {
  name: "test",
  operationId: undefined,
  defaultStatusCode: 200,
  paramsType: {},
  queryType: {},
  bodyType: {},
  returnType: {},
  errors: [],
  controllerName: "TestController",
  validateInput: true,
  validateOutput: true,
  description: "Test description",
  returnDescription: "Test return description",
};

describe("service/validator", () => {
  describe("Validator", () => {
    const validator = new Validator();
    const dummyRequest = createDummyRequest();
    const dummyResponse = createDummyResponse();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe("#validateRequest", () => {
      const metadata: ActionMetadata = {
        ...BASE_ACTION_METADATA,
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
        paramsType: {
          additionalProperties: false,
          properties: {
            name: {
              type: "string",
            },
          },
          required: ["name"],
          type: "object",
        },
      };

      it("should return undefined if the request is valid", () => {
        (dummyRequest.getBody as jest.Mock).mockReturnValueOnce({
          age: 18,
        });
        (dummyRequest.getQuery as jest.Mock).mockReturnValueOnce({
          country: "fr",
        });
        (dummyRequest.getParams as jest.Mock).mockReturnValueOnce({
          name: "John",
        });

        expect(validator.validateRequest(metadata, dummyRequest)).toBe(
          undefined
        );
      });

      it("should return an error if the payload is invalid", () => {
        (dummyRequest.getBody as jest.Mock).mockReturnValueOnce({
          age: "eighteen",
        });
        (dummyRequest.getQuery as jest.Mock).mockReturnValueOnce({
          country: [30],
        });
        (dummyRequest.getParams as jest.Mock).mockReturnValueOnce({});

        expect(validator.validateRequest(metadata, dummyRequest)).toEqual([
          {
            errors: [
              {
                instancePath: "/age",
                keyword: "type",
                message: "must be number",
                params: { type: "number" },
                schemaPath: "#/properties/age/type",
              },
            ],
            source: "body",
          },
          {
            errors: [
              {
                instancePath: "",
                keyword: "required",
                message: "must have required property 'name'",
                params: { missingProperty: "name" },
                schemaPath: "#/required",
              },
            ],
            source: "params",
          },
          {
            errors: [
              {
                instancePath: "/country",
                keyword: "type",
                message: "must be string",
                params: { type: "string" },
                schemaPath: "#/properties/country/type",
              },
            ],
            source: "query",
          },
        ]);
      });
    });

    describe("#validateResponse", () => {
      const metadata: ActionMetadata = {
        ...BASE_ACTION_METADATA,
        returnType: {
          additionalProperties: false,
          properties: {
            age: {
              type: "number",
            },
          },
          required: ["age"],
          type: "object",
        },
      };

      it("should return undefined if the response is valid", () => {
        (dummyResponse.getBody as jest.Mock).mockReturnValueOnce({
          age: 18,
        });

        expect(validator.validateResponse(metadata, dummyResponse)).toBe(
          undefined
        );
      });

      it("should return an error if the payload is invalid", () => {
        (dummyResponse.getBody as jest.Mock).mockReturnValueOnce({
          age: "eighteen",
        });

        expect(validator.validateResponse(metadata, dummyResponse)).toEqual([
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
      });
    });
  });
});
