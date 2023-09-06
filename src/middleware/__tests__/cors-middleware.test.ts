import {
  REQUEST_PHASE,
  AbstractRequest,
  AbstractResponse,
  Context,
} from "@alliage/webserver";

import { CORSMiddleware } from "../cors-middleware";

function createDummyResponse() {
  const response = {
    setHeader: jest.fn(),
  } as unknown as AbstractResponse;
  return response;
}

function createDummyRequest(origin: string, method: string) {
  const headers = { Origin: origin };
  const request = {
    getHeader: (key: keyof typeof headers) => headers[key],
    getMethod: () => method,
  } as unknown as AbstractRequest;
  return request;
}

describe("middleware/cors-middleware", () => {
  describe("CORSMiddleware", () => {
    const middleware = new CORSMiddleware([
      {
        origin: "http://myapp.dev",
      },
    ]);

    describe("#getRequestPhase", () => {
      it("should apply before the controllers", () => {
        expect(middleware.getRequestPhase()).toBe(REQUEST_PHASE.PRE_CONTROLLER);
      });
    });

    describe("#apply", () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should apply the CORS headers when there's a configuration for the given origin", async () => {
        const dummyRequest = createDummyRequest("http://myapp.dev", "POST");
        const dummyResponse = createDummyResponse();
        const context = new Context(dummyRequest, dummyResponse, "express");

        await middleware.apply(context);

        expect(dummyResponse.setHeader).toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          "http://myapp.dev"
        );
      });

      it("should not do anything if there's no configuration for the given origin", async () => {
        const dummyRequest = createDummyRequest(
          "http://unknown.origin",
          "POST"
        );
        const dummyResponse = createDummyResponse();
        const context = new Context(dummyRequest, dummyResponse, "express");

        await middleware.apply(context);

        expect(dummyResponse.setHeader).not.toHaveBeenCalled();
      });
    });
  });
});
