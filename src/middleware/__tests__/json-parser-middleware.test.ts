import { Readable } from "stream";

import {
  REQUEST_PHASE,
  AbstractRequest,
  AbstractResponse,
  Context,
} from "@alliage/webserver";

import { JSONParserMiddleware } from "../json-parser-middleware";
import { HttpError } from "../../error";

function createDummyResponse() {
  const response = {} as unknown as AbstractResponse;
  return response;
}

let readable: Readable;

function resetReadable() {
  readable = new Readable();
  readable._read = () => undefined;
}

function createDummyRequest() {
  const request = {
    setBody: jest.fn().mockImplementation(() => request),
    getHeader: jest.fn(),
    getReadableStream: jest.fn().mockImplementation(() => readable),
  } as unknown as AbstractRequest;
  return request;
}

describe("middleware/json-parser-middleware", () => {
  describe("JSONParserMiddleware", () => {
    const middleware = new JSONParserMiddleware();

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
        resetReadable();
      });

      it('should transform the body when the Content-Type is "application/json"', async () => {
        dummyRequest.getReadableStream().push('{"foo":"bar"}');
        dummyRequest.getReadableStream().push(null);
        (dummyRequest.getHeader as jest.Mock).mockReturnValue(
          "application/json"
        );

        await middleware.apply(context);

        expect(dummyRequest.setBody).toHaveBeenCalledWith({ foo: "bar" });
      });

      it('should not transform the body when the Content-Type is not "application/json"', async () => {
        dummyRequest.getReadableStream().push("<test></test>");
        dummyRequest.getReadableStream().push(null);
        (dummyRequest.getHeader as jest.Mock).mockReturnValue(
          "application/xml"
        );

        await middleware.apply(context);

        expect(dummyRequest.setBody).not.toHaveBeenCalledWith();
      });

      it("should throw a 400 error when the JSON is not valid", async () => {
        dummyRequest.getReadableStream().push("<test></test>");
        dummyRequest.getReadableStream().push(null);
        (dummyRequest.getHeader as jest.Mock).mockReturnValue(
          "application/json"
        );

        let error: Error | undefined = undefined;
        try {
          await middleware.apply(context);
        } catch (e) {
          error = e as Error;
        }

        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError<400, unknown>).payload).toEqual({
          message: "Invalid JSON",
        });
        expect((error as HttpError<400, unknown>).code).toBe(400);
      });

      it("should throw an error if the stream returns an error", async () => {
        const thrownError = new Error("test");
        dummyRequest.getReadableStream().push('{"foor": "bar"}');
        (dummyRequest.getHeader as jest.Mock).mockReturnValue(
          "application/json"
        );

        let error: Error | undefined = undefined;
        try {
          setTimeout(() =>
            dummyRequest.getReadableStream().emit("error", thrownError)
          );
          await middleware.apply(context);
        } catch (e) {
          error = e as Error;
        }

        expect(error).toBe(thrownError);
      });
    });
  });
});
