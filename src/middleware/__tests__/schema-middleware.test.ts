import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  REQUEST_PHASE,
  AbstractResponse,
  AbstractRequest,
  Context,
} from "@alliage/webserver";

import { SchemaMiddleware } from "../schema-middleware.js";
import { SchemaGenerator } from "../../service/schema-generator.js";

function createDummyResponse() {
  const response = {
    setStatus: vi.fn().mockImplementation(() => response),
    setBody: vi.fn().mockImplementation(() => response),
    end: vi.fn().mockImplementation(() => response),
  } as unknown as AbstractResponse;
  return response;
}

function createDummyRequest() {
  const request = {
    getPath: vi.fn(),
  } as unknown as AbstractRequest;
  return request;
}

describe("middleware/schema-middleware", () => {
  describe("SchemaMiddleware", () => {
    const dummySchemaGenerator = {
      getSchema: vi.fn(),
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
        vi.clearAllMocks();
      });

      it("should return the schema", async () => {
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs");
        (dummySchemaGenerator.getSchema as Mock).mockResolvedValueOnce({
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
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs");
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
        (dummyRequest.getPath as Mock).mockReturnValueOnce(
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
