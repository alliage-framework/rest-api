import {
  REQUEST_PHASE,
  AbstractMiddleware,
  Context,
  AbstractResponse,
} from "@alliage/webserver";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import path from "path";
import { open } from "fs/promises";
import { access, constants, stat } from "fs/promises";

import { Config } from "../config/main.js";
import { SchemaGenerator } from "../service/schema-generator.js";

const EXTENSION_CONTENT_TYPES_MAPPING: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".map": "application/json",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

// Maximum file size to serve (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file extensions for security
const ALLOWED_EXTENSIONS = new Set(Object.keys(EXTENSION_CONTENT_TYPES_MAPPING));

/**
 * Exposes the OpenAPI Schema and SwaggerUI
 */
export class SchemaMiddleware extends AbstractMiddleware {
  constructor(
    private schemaGenerator: SchemaGenerator,
    private schemaConfig: Config["schema"]
  ) {
    super();
  }

  getRequestPhase = () => REQUEST_PHASE.PRE_CONTROLLER;

  async apply(context: Context) {
    const requestPath = context.getRequest().getPath();

    if (!this.schemaConfig.enable) {
      return;
    }

    // Serve the schema.json file
    if (requestPath === `${this.schemaConfig.path}/schema.json`) {
      await this._serveOpenApiSchema(context.getResponse());
      return;
    }

    // Serve the swagger-ui files
    if (requestPath.startsWith(this.schemaConfig.path)) {
      const routePath = requestPath.substring(this.schemaConfig.path.length);
      await this._serveSwaggerUi(routePath, context.getResponse());
      return;
    }
  }

  private async _serveOpenApiSchema(response: AbstractResponse) {
    const schema = await this.schemaGenerator.getSchema();
    
    // Set security headers
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    response
      .setHeader("Content-Type", "application/json")
      .setStatus(200)
      .setBody(schema)
      .end();
  }

  private async _serveSwaggerUi(routePath: string, response: AbstractResponse) {
    const root = getAbsoluteFSPath();
    
    // Handle empty path by redirecting to path with trailing slash
    if (routePath === "") {
      response.setStatus(301).setHeader("Location", `${this.schemaConfig.path}/`).end();
      return;
    }
    
    // Sanitize the route path to prevent path traversal
    const sanitizedPath = this._sanitizePath(routePath);
    if (!sanitizedPath) {
      response.setStatus(403).setBody("Forbidden").end();
      return;
    }
    
    const filePath = path.resolve(root, sanitizedPath);
    
    // Ensure the resolved path is still within the SwaggerUI directory
    const relativePath = path.relative(root, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      response.setStatus(403).setBody("Forbidden").end();
      return;
    }
    
    if (filePath.endsWith("swagger-initializer.js")) {
      await this._serverSwaggerInitializer(response);
      return;
    }
    
    await this._serveStaticFile(filePath, response);
  }

  private _sanitizePath(routePath: string): string | null {
    // Handle root path with trailing slash
    if (routePath === "/") {
      return "index.html";
    }
    
    // Remove leading slash if present
    const cleanPath = routePath.startsWith("/") ? routePath.slice(1) : routePath;
    
    // Check for suspicious patterns
    if (cleanPath.includes("..") || cleanPath.includes("~") || cleanPath.includes("\\")) {
      return null;
    }
    
    // Validate file extension
    const extension = path.extname(cleanPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return null;
    }
    
    return cleanPath;
  }

  private async _serveStaticFile(filePath: string, response: AbstractResponse) {
    try {
      // Check file accessibility and get stats
      await access(filePath, constants.R_OK);
      const stats = await stat(filePath);
      
      // Check if it's a file and not too large
      if (!stats.isFile() || stats.size > MAX_FILE_SIZE) {
        response.setStatus(404).setBody("File not found.").end();
        return;
      }
    } catch (_error) {
      response.setStatus(404).setBody("File not found.").end();
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = EXTENSION_CONTENT_TYPES_MAPPING[extension] ?? "application/octet-stream";
    
    // Set security headers
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("Content-Type", contentType);

    const file = await open(filePath, "r");
    const fileStream = file.createReadStream();
    fileStream.pipe(response.getWritableStream());
    
    const {
      promise: fileStreamEndPromise,
      resolve,
      reject,
    } = Promise.withResolvers<void>();
    
    fileStream.on("end", resolve);
    fileStream.on("error", reject);
    
    try {
      await fileStreamEndPromise;
    } finally {
      await file.close();
    }
    
    response.end();
  }

  private _serverSwaggerInitializer(response: AbstractResponse) {
    // Set security headers
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "SAMEORIGIN");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    response
      .setHeader("Content-Type", "application/javascript")
      .setStatus(200)
      .setBody(
        `
window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: "${this.schemaConfig.path}/schema.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  });
};
      `
      )
      .end();
  }
}
