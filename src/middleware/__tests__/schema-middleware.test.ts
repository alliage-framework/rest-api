import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  REQUEST_PHASE,
  AbstractResponse,
  AbstractRequest,
  Context,
} from "@alliage/webserver";
import { Readable, Writable } from "stream";

import { SchemaMiddleware } from "../schema-middleware.js";
import { SchemaGenerator } from "../../service/schema-generator.js";

// Mock swagger-ui-dist
vi.mock("swagger-ui-dist", () => ({
  getAbsoluteFSPath: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  constants: { R_OK: 4 },
  open: vi.fn(),
  stat: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  default: {
    extname: vi.fn(),
    resolve: vi.fn(),
    relative: vi.fn(),
    isAbsolute: vi.fn(),
  },
  extname: vi.fn(),
  resolve: vi.fn(),
  relative: vi.fn(),
  isAbsolute: vi.fn(),
}));

function createDummyResponse() {
  const writableStream = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const response = {
    setStatus: vi.fn().mockImplementation(() => response),
    setBody: vi.fn().mockImplementation(() => response),
    setHeader: vi.fn().mockImplementation(() => response),
    end: vi.fn().mockImplementation(() => response),
    getWritableStream: vi.fn().mockReturnValue(writableStream),
  } as unknown as AbstractResponse;
  return response;
}

function createDummyRequest() {
  const request = {
    getPath: vi.fn(),
  } as unknown as AbstractRequest;
  return request;
}

function createMockFile(size = 1000) {
  const readStream = new Readable({
    read() {
      this.push("mock file content");
      this.push(null);
    },
  });
  
  // Mock pipe to avoid stream piping complexities
  readStream.pipe = vi.fn().mockImplementation((dest) => {
    // Simulate immediate completion
    setTimeout(() => {
      readStream.emit("end");
    }, 0);
    return dest;
  });
  
  return {
    createReadStream: vi.fn().mockReturnValue(readStream),
    close: vi.fn().mockResolvedValue(undefined),
    stats: {
      isFile: () => true,
      size,
    },
  };
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

      it("should not do anything if schema is disabled", async () => {
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/schema.json");
        const disabledMiddleware = new SchemaMiddleware(
          dummySchemaGenerator,
          { enable: false, path: "/api/specs" }
        );
        await disabledMiddleware.apply(context);

        expect(dummyResponse.setBody).not.toHaveBeenCalled();
        expect(dummyResponse.setStatus).not.toHaveBeenCalled();
        expect(dummyResponse.end).not.toHaveBeenCalled();
      });

      it("should serve the schema.json file with security headers", async () => {
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/schema.json");
        (dummySchemaGenerator.getSchema as Mock).mockResolvedValueOnce({
          test: "DUMMY_SCHEMA",
        });
        
        await middleware.apply(context);

        expect(dummyResponse.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-store, must-revalidate");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        expect(dummyResponse.setStatus).toHaveBeenCalledWith(200);
        expect(dummyResponse.setBody).toHaveBeenCalledWith({
          test: "DUMMY_SCHEMA",
        });
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should serve swagger-ui files when path matches and extension is allowed", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/index.html");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/index.html");
        (path.default.relative as Mock).mockReturnValue("index.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const mockFile = createMockFile();
        (stat as Mock).mockResolvedValueOnce(mockFile.stats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        await middleware.apply(context);

        expect(dummyResponse.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("X-Frame-Options", "SAMEORIGIN");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=3600");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
        expect(mockFile.close).toHaveBeenCalled();
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should serve swagger-ui root path as index.html", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/index.html");
        (path.default.relative as Mock).mockReturnValue("index.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const mockFile = createMockFile();
        (stat as Mock).mockResolvedValueOnce(mockFile.stats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        await middleware.apply(context);

        expect(path.default.resolve).toHaveBeenCalledWith("/mock/swagger-ui/dist", "index.html");
      });

      it("should serve swagger-ui root path with trailing slash as index.html", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/index.html");
        (path.default.relative as Mock).mockReturnValue("index.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const mockFile = createMockFile();
        (stat as Mock).mockResolvedValueOnce(mockFile.stats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        await middleware.apply(context);

        expect(path.default.resolve).toHaveBeenCalledWith("/mock/swagger-ui/dist", "index.html");
      });

      it("should serve swagger-initializer.js with custom content and security headers", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/swagger-initializer.js");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/swagger-initializer.js");
        (path.default.relative as Mock).mockReturnValue("swagger-initializer.js");
        (path.default.isAbsolute as Mock).mockReturnValue(false);

        await middleware.apply(context);

        expect(dummyResponse.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("X-Frame-Options", "SAMEORIGIN");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-store, must-revalidate");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", "application/javascript");
        expect(dummyResponse.setStatus).toHaveBeenCalledWith(200);
        expect(dummyResponse.setBody).toHaveBeenCalledWith(
          expect.stringContaining('url: "/api/specs/schema.json"')
        );
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should handle different allowed file extensions with correct content types", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        const testCases = [
          { ext: ".css", contentType: "text/css" },
          { ext: ".js", contentType: "application/javascript" },
          { ext: ".png", contentType: "image/png" },
          { ext: ".map", contentType: "application/json" },
          { ext: ".ico", contentType: "image/x-icon" },
          { ext: ".svg", contentType: "image/svg+xml" },
        ];

        for (const testCase of testCases) {
          vi.clearAllMocks();
          
          (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
          (dummyRequest.getPath as Mock).mockReturnValueOnce(`/api/specs/test${testCase.ext}`);
          (access as Mock).mockResolvedValueOnce(undefined);
          (path.default.extname as Mock).mockReturnValue(testCase.ext);
          (path.default.resolve as Mock).mockReturnValue(`/mock/swagger-ui/dist/test${testCase.ext}`);
          (path.default.relative as Mock).mockReturnValue(`test${testCase.ext}`);
          (path.default.isAbsolute as Mock).mockReturnValue(false);
          
          const mockFile = createMockFile();
          (stat as Mock).mockResolvedValueOnce(mockFile.stats);
          (open as Mock).mockResolvedValueOnce(mockFile);

          await middleware.apply(context);

          expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", testCase.contentType);
        }
      });

      it("should block disallowed file extensions", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const path = await import("path");
        
        const disallowedExtensions = [".exe", ".php", ".asp", ".jsp", ".txt"];

        for (const ext of disallowedExtensions) {
          vi.clearAllMocks();
          
          (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
          (dummyRequest.getPath as Mock).mockReturnValueOnce(`/api/specs/malicious${ext}`);
          (path.default.extname as Mock).mockReturnValue(ext);

          await middleware.apply(context);

          expect(dummyResponse.setStatus).toHaveBeenCalledWith(403);
          expect(dummyResponse.setBody).toHaveBeenCalledWith("Forbidden");
          expect(dummyResponse.end).toHaveBeenCalled();
        }
      });

      it("should block files without extensions", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const path = await import("path");
        
        vi.clearAllMocks();
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/noextension");
        (path.default.extname as Mock).mockReturnValue("");

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(403);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("Forbidden");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should block path traversal attempts", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        
        const maliciousPaths = [
          "../../../etc/passwd",
          "..\\..\\..\\windows\\system32\\config\\sam",
          "~/secret.txt",
          "../config.js",
        ];

        for (const maliciousPath of maliciousPaths) {
          vi.clearAllMocks();
          
          (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
          (dummyRequest.getPath as Mock).mockReturnValueOnce(`/api/specs/${maliciousPath}`);

          await middleware.apply(context);

          expect(dummyResponse.setStatus).toHaveBeenCalledWith(403);
          expect(dummyResponse.setBody).toHaveBeenCalledWith("Forbidden");
          expect(dummyResponse.end).toHaveBeenCalled();
        }
      });

      it("should block attempts to escape the SwaggerUI directory", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/test.html");
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/outside/directory/test.html");
        (path.default.relative as Mock).mockReturnValue("../../../outside/directory/test.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(403);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("Forbidden");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should block absolute path attempts", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/test.html");
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/test.html");
        (path.default.relative as Mock).mockReturnValue("/absolute/path/test.html");
        (path.default.isAbsolute as Mock).mockReturnValue(true);

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(403);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("Forbidden");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should return 404 when static file is not accessible", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/nonexistent.html");
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/nonexistent.html");
        (path.default.relative as Mock).mockReturnValue("nonexistent.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        (access as Mock).mockRejectedValueOnce(new Error("File not found"));

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(404);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("File not found.");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should return 404 for files that are too large", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/large.html");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/large.html");
        (path.default.relative as Mock).mockReturnValue("large.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        // Mock a file larger than 10MB
        const largeFileStats = {
          isFile: () => true,
          size: 11 * 1024 * 1024, // 11MB
        };
        (stat as Mock).mockResolvedValueOnce(largeFileStats);

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(404);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("File not found.");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should return 404 for directories", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/directory.html");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/directory.html");
        (path.default.relative as Mock).mockReturnValue("directory.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        // Mock a directory instead of a file
        const directoryStats = {
          isFile: () => false,
          size: 0,
        };
        (stat as Mock).mockResolvedValueOnce(directoryStats);

        await middleware.apply(context);

        expect(dummyResponse.setStatus).toHaveBeenCalledWith(404);
        expect(dummyResponse.setBody).toHaveBeenCalledWith("File not found.");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should not do anything for paths that don't match schema config", async () => {
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/other/path");
        
        await middleware.apply(context);

        expect(dummyResponse.setBody).not.toHaveBeenCalled();
        expect(dummyResponse.setStatus).not.toHaveBeenCalled();
        expect(dummyResponse.end).not.toHaveBeenCalled();
      });

      it("should handle file stream errors gracefully and ensure file is closed", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/error.html");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/error.html");
        (path.default.relative as Mock).mockReturnValue("error.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const errorStream = new Readable({
          read() { /* no-op */ },
        });
        
        const mockFile = {
          createReadStream: vi.fn().mockReturnValue(errorStream),
          close: vi.fn().mockResolvedValue(undefined),
        };
        
        const mockFileStats = {
          isFile: () => true,
          size: 1000,
        };
        
        (stat as Mock).mockResolvedValueOnce(mockFileStats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        // Start the middleware apply
        const applyPromise = middleware.apply(context);
        
        // Immediately emit the error to simulate stream error
        setImmediate(() => {
          errorStream.emit("error", new Error("Stream error"));
        });

        await expect(applyPromise).rejects.toThrow("Stream error");
        // file.close() IS called in the finally block even on error
        expect(mockFile.close).toHaveBeenCalled();
      });

      it("should handle route paths without leading slash", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specstest.html");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock).mockReturnValue(".html");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/test.html");
        (path.default.relative as Mock).mockReturnValue("test.html");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const mockFile = createMockFile();
        (stat as Mock).mockResolvedValueOnce(mockFile.stats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        await middleware.apply(context);

        expect(path.default.resolve).toHaveBeenCalledWith("/mock/swagger-ui/dist", "test.html");
        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
        expect(dummyResponse.end).toHaveBeenCalled();
      });

      it("should use fallback content type for extensions not in mapping", async () => {
        const { getAbsoluteFSPath } = await import("swagger-ui-dist");
        const { access, open, stat } = await import("fs/promises");
        const path = await import("path");
        
        (getAbsoluteFSPath as Mock).mockReturnValue("/mock/swagger-ui/dist/");
        (dummyRequest.getPath as Mock).mockReturnValueOnce("/api/specs/test.svg");
        (access as Mock).mockResolvedValueOnce(undefined);
        (path.default.extname as Mock)
          .mockReturnValueOnce(".svg")
          .mockReturnValueOnce(".unmapped");
        (path.default.resolve as Mock).mockReturnValue("/mock/swagger-ui/dist/test.svg");
        (path.default.relative as Mock).mockReturnValue("test.svg");
        (path.default.isAbsolute as Mock).mockReturnValue(false);
        
        const mockFile = createMockFile();
        (stat as Mock).mockResolvedValueOnce(mockFile.stats);
        (open as Mock).mockResolvedValueOnce(mockFile);

        await middleware.apply(context);

        expect(dummyResponse.setHeader).toHaveBeenCalledWith("Content-Type", "application/octet-stream");
        expect(dummyResponse.end).toHaveBeenCalled();
      });
    });
  });
});
