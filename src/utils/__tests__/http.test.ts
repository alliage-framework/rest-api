import { AbstractRequest, AbstractResponse } from "@alliage/webserver";

import { addAccessControlHeaders } from "../http";

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

describe("utils/http", () => {
  describe("#addAccessControlHEaders", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should add the Access-Control-Allow-Origin for normal requests", () => {
      const dummyRequest = createDummyRequest("http://myapp.dev", "POST");
      const dummyResponse = createDummyResponse();

      addAccessControlHeaders(dummyRequest, dummyResponse, [
        { origin: "http://myapp.dev" },
      ]);

      expect(dummyResponse.setHeader).toHaveBeenCalledTimes(1);
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "http://myapp.dev"
      );
    });

    it("should add the Access-Control-Allow-Headers, Access-Control-Allow-Methods and Access-Control-Max-Age headers for preflight requests", () => {
      const dummyRequest = createDummyRequest("http://myapp.dev", "OPTIONS");
      const dummyResponse = createDummyResponse();

      addAccessControlHeaders(dummyRequest, dummyResponse, [
        {
          origin: "http://myapp.dev",
          headers: ["x-custom-header"],
          methods: ["GET", "POST"],
          maxAge: 3600,
        },
      ]);

      expect(dummyResponse.setHeader).toHaveBeenCalledTimes(4);
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "http://myapp.dev"
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "x-custom-header"
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST"
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Max-Age",
        "3600"
      );
    });

    it("should add empty Access-Control-Allow-Headers, Access-Control-Allow-Methods and Access-Control-Max-Age headers for preflight requests if they're not configured", () => {
      const dummyRequest = createDummyRequest("http://myapp.dev", "OPTIONS");
      const dummyResponse = createDummyResponse();

      addAccessControlHeaders(dummyRequest, dummyResponse, [
        {
          origin: "http://myapp.dev",
        },
      ]);

      expect(dummyResponse.setHeader).toHaveBeenCalledTimes(4);
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "http://myapp.dev"
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        ""
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        ""
      );
      expect(dummyResponse.setHeader).toHaveBeenCalledWith(
        "Access-Control-Max-Age",
        ""
      );
    });

    it("should not do anything if no configuration exist for the given origin", () => {
      const dummyRequest = createDummyRequest(
        "http://unknown.origin",
        "OPTIONS"
      );
      const dummyResponse = createDummyResponse();

      addAccessControlHeaders(dummyRequest, dummyResponse, [
        {
          origin: "http://myapp.dev",
          headers: ["x-custom-header"],
          methods: ["GET", "POST"],
          maxAge: 3600,
        },
      ]);

      expect(dummyResponse.setHeader).not.toHaveBeenCalled();
    });

    it("should not do anything if there's no configuration at all", () => {
      const dummyRequest = createDummyRequest("http://myapp.dev", "OPTIONS");
      const dummyResponse = createDummyResponse();

      addAccessControlHeaders(dummyRequest, dummyResponse, undefined);

      expect(dummyResponse.setHeader).not.toHaveBeenCalled();
    });
  });
});
