import { AbstractRequest, AbstractResponse } from "@alliage/webserver";

import {
  RestAPIInvalidRequestEvent,
  RestAPIPreValidateRequestEvent,
  RestAPIPostValidateRequestEvent,
  REST_API_EVENTS,
  RestAPIPreValidateResponseEvent,
  RestAPIInvalidResponseEvent,
  RestAPIPostValidateResponseEvent,
  RestAPIPreErrorEvent,
  RestAPIPostErrorEvent,
  RestAPIPreGenerateSchemaEvent,
  RestAPIPostGenerateSchemaEvent,
} from "../events";
import { ActionMetadata, Metadata } from "../service/metadata-manager";
import { Config as OpenAPISpecs } from "../config/openapi-specs";
import { ValidationErrors } from "../service/validator";

describe("events", () => {
  const dummyMetadata = {} as unknown as ActionMetadata;
  const dummyRequest = {} as unknown as AbstractRequest;
  const dummyResponse = {} as unknown as AbstractResponse;
  const dummyErrors: ValidationErrors[] = [];

  describe("RestAPIPreValidateRequestEvent", () => {
    const event = new RestAPIPreValidateRequestEvent(
      dummyMetadata,
      dummyRequest
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.PRE_VALIDATE_REQUEST event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.PRE_VALIDATE_REQUEST);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getRequest", () => {
      it("should return request", () => {
        expect(event.getRequest()).toBe(dummyRequest);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIPreValidateRequestEvent.getParams(
          dummyMetadata,
          dummyRequest
        );

        expect(params[0]).toEqual(REST_API_EVENTS.PRE_VALIDATE_REQUEST);

        const eventInstance = params[1] as RestAPIPreValidateRequestEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getRequest()).toBe(dummyRequest);
      });
    });
  });

  describe("RestAPIInvalidRequestEvent", () => {
    const event = new RestAPIInvalidRequestEvent(
      dummyMetadata,
      dummyRequest,
      dummyErrors
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.INVALID_REQUEST event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.INVALID_REQUEST);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getRequest", () => {
      it("should return request", () => {
        expect(event.getRequest()).toBe(dummyRequest);
      });
    });

    describe("#getErrors", () => {
      it("should return errors", () => {
        expect(event.getErrors()).toBe(dummyErrors);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIInvalidRequestEvent.getParams(
          dummyMetadata,
          dummyRequest,
          dummyErrors
        );

        expect(params[0]).toEqual(REST_API_EVENTS.INVALID_REQUEST);

        const eventInstance = params[1] as RestAPIInvalidRequestEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getRequest()).toBe(dummyRequest);
        expect(eventInstance.getErrors()).toBe(dummyErrors);
      });
    });
  });

  describe("RestAPIPostValidateRequestEvent", () => {
    const event = new RestAPIPostValidateRequestEvent(
      dummyMetadata,
      dummyRequest
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.POST_VALIDATE_REQUEST event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.POST_VALIDATE_REQUEST);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getRequest", () => {
      it("should return request", () => {
        expect(event.getRequest()).toBe(dummyRequest);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIPostValidateRequestEvent.getParams(
          dummyMetadata,
          dummyRequest
        );

        expect(params[0]).toEqual(REST_API_EVENTS.POST_VALIDATE_REQUEST);

        const eventInstance = params[1] as RestAPIPostValidateRequestEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getRequest()).toBe(dummyRequest);
      });
    });
  });

  describe("RestAPIPreValidateResponseEvent", () => {
    const event = new RestAPIPreValidateResponseEvent(
      dummyMetadata,
      dummyResponse
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.PRE_VALIDATE_RESPONSE event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.PRE_VALIDATE_RESPONSE);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getResponse", () => {
      it("should return response", () => {
        expect(event.getResponse()).toBe(dummyResponse);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIPreValidateResponseEvent.getParams(
          dummyMetadata,
          dummyResponse
        );

        expect(params[0]).toBe(REST_API_EVENTS.PRE_VALIDATE_RESPONSE);

        const eventInstance = params[1] as RestAPIPreValidateResponseEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getResponse()).toBe(dummyResponse);
      });
    });
  });

  describe("RestAPIInvalidResponseEvent", () => {
    const event = new RestAPIInvalidResponseEvent(
      dummyMetadata,
      dummyResponse,
      dummyErrors
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.INVALID_RESPONSE event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.INVALID_RESPONSE);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getResponse", () => {
      it("should return response", () => {
        expect(event.getResponse()).toBe(dummyResponse);
      });
    });

    describe("#getErrors", () => {
      it("should return errors", () => {
        expect(event.getErrors()).toBe(dummyErrors);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIInvalidResponseEvent.getParams(
          dummyMetadata,
          dummyResponse,
          dummyErrors
        );

        expect(params[0]).toBe(REST_API_EVENTS.INVALID_RESPONSE);

        const eventInstance = params[1] as RestAPIInvalidResponseEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getResponse()).toBe(dummyResponse);
        expect(eventInstance.getErrors()).toBe(dummyErrors);
      });
    });
  });

  describe("RestAPIPostValidateResponseEvent", () => {
    const event = new RestAPIPostValidateResponseEvent(
      dummyMetadata,
      dummyResponse
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.POST_VALIDATE_RESPONSE event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.POST_VALIDATE_RESPONSE);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummyMetadata);
      });
    });

    describe("#getResponse", () => {
      it("should return response", () => {
        expect(event.getResponse()).toBe(dummyResponse);
      });
    });

    describe("#getParams", () => {
      it('should return the params accepted by the "EventManager.emit" method', () => {
        const params = RestAPIPostValidateResponseEvent.getParams(
          dummyMetadata,
          dummyResponse
        );

        expect(params[0]).toBe(REST_API_EVENTS.POST_VALIDATE_RESPONSE);

        const eventInstance = params[1] as RestAPIPostValidateResponseEvent;
        expect(eventInstance.getMetadata()).toBe(dummyMetadata);
        expect(eventInstance.getResponse()).toBe(dummyResponse);
      });
    });
  });

  describe("RestAPIPreErrorEvent", () => {
    const dummyError = new Error();
    const dummyBody = { error: "dummy error" };
    const event = new RestAPIPreErrorEvent(
      dummyRequest,
      dummyError,
      400,
      dummyBody
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.PRE_ERROR event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.PRE_ERROR);
      });
    });

    describe("#getRequest", () => {
      it("should return request", () => {
        expect(event.getRequest()).toBe(dummyRequest);
      });
    });

    describe("#getError", () => {
      it("should return error", () => {
        expect(event.getError()).toBe(dummyError);
      });
    });

    describe("#getCode / #setCode", () => {
      it("should return code", () => {
        expect(event.getCode()).toBe(400);
      });

      it("should set code", () => {
        event.setCode(500);
        expect(event.getCode()).toBe(500);
      });
    });

    describe("#getBody / #setBody", () => {
      it("should return body", () => {
        expect(event.getBody()).toBe(dummyBody);
      });

      it("should set body", () => {
        const newBody = { newBody: "new body" };
        event.setBody(newBody);
        expect(event.getBody()).toBe(newBody);
      });
    });
  });

  describe("RestAPIPostErrorEvent", () => {
    const dummyError = new Error();
    const dummyBody = { error: "dummy error" };
    const event = new RestAPIPostErrorEvent(
      dummyRequest,
      dummyError,
      400,
      dummyBody
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.POST_ERROR event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.POST_ERROR);
      });
    });

    describe("#getRequest", () => {
      it("should return request", () => {
        expect(event.getRequest()).toBe(dummyRequest);
      });
    });

    describe("#getError", () => {
      it("should return error", () => {
        expect(event.getError()).toBe(dummyError);
      });
    });

    describe("#getCode", () => {
      it("should return code", () => {
        expect(event.getCode()).toBe(400);
      });
    });

    describe("#getBody", () => {
      it("should return body", () => {
        expect(event.getBody()).toBe(dummyBody);
      });
    });
  });

  describe("RestAPIPreGenerateSchemaEvent", () => {
    const dummySchemaMetadata = {} as Metadata;
    const event = new RestAPIPreGenerateSchemaEvent(dummySchemaMetadata);

    describe("#getType", () => {
      it("should return REST_API_EVENTS.PRE_GENERATE_SCHEMA event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.PRE_GENERATE_SCHEMA);
      });
    });

    describe("#getMetadata / #setMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummySchemaMetadata);
      });

      it("should set metadata", () => {
        const newSchemaMetadata = {} as Metadata;
        event.setMetadata(newSchemaMetadata);
        expect(event.getMetadata()).toBe(newSchemaMetadata);
      });
    });
  });

  describe("RestAPIPostGenerateSchemaEvent", () => {
    const dummySchemaMetadata = {} as Metadata;
    const dummySchema = {} as OpenAPISpecs;
    const event = new RestAPIPostGenerateSchemaEvent(
      dummySchemaMetadata,
      dummySchema
    );

    describe("#getType", () => {
      it("should return REST_API_EVENTS.POST_GENERATE_SCHEMA event type", () => {
        expect(event.getType()).toBe(REST_API_EVENTS.POST_GENERATE_SCHEMA);
      });
    });

    describe("#getMetadata", () => {
      it("should return metadata", () => {
        expect(event.getMetadata()).toBe(dummySchemaMetadata);
      });
    });

    describe("#getSchema / #setSchema", () => {
      it("should return schema", () => {
        expect(event.getSchema()).toBe(dummySchema);
      });

      it("should set schema", () => {
        const newSchema = {} as OpenAPISpecs;
        event.setSchema(newSchema);
        expect(event.getSchema()).toBe(newSchema);
      });
    });
  });
});
