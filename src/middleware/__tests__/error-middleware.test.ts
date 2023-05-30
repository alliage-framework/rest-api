import { EventManager } from "@alliage/lifecycle";
import {
  REQUEST_PHASE,
  AbstractRequest,
  AbstractResponse,
  Context,
} from "@alliage/webserver";

import { HttpError } from "../../error";
import {
  RestAPIPostErrorEvent,
  RestAPIPreErrorEvent,
  REST_API_EVENTS,
} from "../../events";
import { ErrorMiddleware } from "../error-middleware";

function createDummyResponse() {
  const response = {
    setStatus: jest.fn().mockImplementation(() => response),
    setBody: jest.fn().mockImplementation(() => response),
    end: jest.fn().mockImplementation(() => response),
  } as unknown as AbstractResponse;
  return response;
}

describe("middleware/error-middleware", () => {
  describe("ErrorMiddleware", () => {
    const eventManager = new EventManager();
    const errorMiddleware = new ErrorMiddleware(eventManager, "production");

    describe("#getRequestPhase", () => {
      it("should apply after the controllers", () => {
        expect(errorMiddleware.getRequestPhase()).toBe(
          REQUEST_PHASE.POST_CONTROLLER
        );
      });
    });

    describe("#apply", () => {
      const request = {} as unknown as AbstractRequest;
      const response = createDummyResponse();
      const context = new Context(request, response, "express");

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should set the status to 500 if the error is not an HttpError", async () => {
        await errorMiddleware.apply(context, new Error("test"));
        expect(response.setStatus).toHaveBeenCalledWith(500);
        expect(response.end).toHaveBeenCalledTimes(1);
      });

      it('should not add debug information if the env is "production"', async () => {
        await errorMiddleware.apply(context, new Error("test"));
        expect(response.setBody).toHaveBeenCalledWith({
          message: "Internal error",
        });
        expect(response.end).toHaveBeenCalledTimes(1);
      });

      it('should add debug information if the environment is "development"', async () => {
        const devErrorMiddleware = new ErrorMiddleware(
          eventManager,
          "development"
        );
        await devErrorMiddleware.apply(context, new Error("test"));
        expect(response.setBody).toHaveBeenCalledWith({
          message: "Internal error",
          debug: {
            name: "Error",
            message: "test",
            stack: expect.any(String),
          },
        });
        expect(response.end).toHaveBeenCalledTimes(1);
      });

      it("should set the status to the error code if the error is an HttpError", async () => {
        await errorMiddleware.apply(context, new HttpError(404, "test"));
        expect(response.setStatus).toHaveBeenCalledWith(404);
        expect(response.end).toHaveBeenCalledTimes(1);
      });

      it("should set the body to the error payload if the error is an HttpError", async () => {
        await errorMiddleware.apply(
          context,
          new HttpError(404, { message: "test" })
        );
        expect(response.setBody).toHaveBeenCalledWith({
          message: "test",
        });
        expect(response.end).toHaveBeenCalledTimes(1);
      });

      it("should trigger events and take their modifications in account", async () => {
        const error = new HttpError(404, { message: "test" });

        eventManager.on(
          REST_API_EVENTS.PRE_ERROR,
          (event: RestAPIPreErrorEvent) => {
            expect(event.getBody()).toEqual({ message: "test" });
            expect(event.getCode()).toBe(404);
            expect(event.getRequest()).toBe(request);
            expect(event.getError()).toBe(error);
            event.setBody({ foo: "bar" });
            event.setCode(406);
          }
        );

        eventManager.on(
          REST_API_EVENTS.POST_ERROR,
          (event: RestAPIPostErrorEvent) => {
            expect(event.getBody()).toEqual({ foo: "bar" });
            expect(event.getCode()).toBe(406);
            expect(event.getRequest()).toBe(request);
            expect(event.getError()).toBe(error);
          }
        );

        await errorMiddleware.apply(context, error);
        expect(response.setBody).toHaveBeenCalledWith({ foo: "bar" });
        expect(response.setStatus).toHaveBeenCalledWith(406);
        expect(response.end).toHaveBeenCalledTimes(1);
      });
    });
  });
});
