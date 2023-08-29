import {
  REQUEST_PHASE,
  AbstractResponse,
  AbstractRequest,
  Context,
} from "@alliage/webserver";

import { SchemaMiddleware } from "../schema-middleware";
import { SchemaGenerator } from "../../service";

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
    const dummySchemaGenerator = {
      getSchema: jest.fn(),
    } as unknown as SchemaGenerator;
    const middleware = new SchemaMiddleware(dummySchemaGenerator, {
      enable: true,
      path: "/api/specs",
    });

    describe("#getRequestPhase", () => {
      it("should apply before the controllers", () => {
        expect(middleware.getRequestPhase()).toBe(REQUEST_PHASE.PRE_CONTROLLER);
      });
    });

    describe("#apply", () => {
      const dummyRequest = createDummyRequest();
      const dummyResponse = createDummyResponse();
      const context = new Context(dummyRequest, dummyResponse, "express");

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should return the schema", async () => {
        (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");
        (dummySchemaGenerator.getSchema as jest.Mock).mockResolvedValueOnce({
          test: "DUMMY_SCHEMA",
        });
        await middleware.apply(context);

        expect(dummyResponse.setBody).toHaveBeenCalledWith({
          test: "DUMMY_SCHEMA",
        });
        expect(dummyResponse.setStatus).toHaveBeenCalledWith(200);
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should not return the schema if the configuration disables it", async () => {
        (dummyRequest.getPath as jest.Mock).mockReturnValueOnce("/api/specs");
        const disabledMiddleware = new SchemaMiddleware(
          dummySchemaGenerator,
          // The schema is disabled
          { enable: false, path: "/api/specs" }
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
    });
  });
});
