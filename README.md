# Alliage REST API

This module facilitates the creation of REST APIs within the Alliage framework. It leverages Alliage Webserver controllers and provides features like automatic OpenAPI schema generation, input/output validation, and CORS configuration.

## What you can achieve (key features)

- Seamless integration with Alliage Webserver controllers.
- Automatic OpenAPI schema generation from routing decorators and JSDOC.
- Built-in validation for request parameters, query strings, request bodies, and response bodies.
- Customizable CORS policy.
- Commands for schema generation and dumping.
- Alliage Builder task for schema generation during the build process.
- Fine-grained configuration options.

## Foundational dependencies

This module builds upon several other Alliage packages:

- `@alliage/webserver`: For handling HTTP requests and responses, and defining controllers.
- `@alliage/configuration-loader`: For loading module configurations.
- `@alliage/service-loader`: For service registration and dependency injection.
- `@alliage/events-listener-loader`: For event handling. (Potentially, if specific events are used beyond standard lifecycle ones)
- `@alliage/builder`: If using the provided builder task for schema pre-generation.

## Getting started: Installation and registration

Let's get your project set up to use `@alliage/rest-api`.

### Installation

Add the module to your project using your preferred package manager:

```bash
yarn add @alliage/rest-api
```

Or with npm:

```bash
npm install @alliage/rest-api
```

### Registration

To integrate the module and its dependencies into your Alliage application, run the following command at the root of your project:

```bash
npx alliage-scripts install @alliage/rest-api
```

This command handles the necessary setup to make the module available within your application's lifecycle.

## Building your first API endpoint: A step-by-step guide

Creating REST endpoints with `@alliage/rest-api` revolves around defining controllers. These controllers, extending `AbstractController` from `@alliage/webserver`, are classes that group related API routes and their logic.

Let's walk through an example:

### 1. Create a controller class

First, define a class that extends `AbstractController`. It's also good practice to decorate it with `@Service` from `@alliage/service-loader`. This makes your controller discoverable by Alliage's dependency injection system, allowing it to be managed and used throughout your application.

```typescript
import { AbstractController, AbstractRequest, Post } from "@alliage/webserver";
import { Service } from "@alliage/service-loader";

@Service("my_controller")
export default class MyController extends AbstractController {
  // Endpoint methods will be defined here
}
```

### 2. Define endpoint methods with HTTP decorators

Inside your controller, methods will handle incoming requests for specific API routes. You map these methods to HTTP verbs (GET, POST, PUT, DELETE, etc.) and URL paths using decorators from `@alliage/webserver`, such as `@Get()`, `@Post()`, etc.

The path provided to the decorator (e.g., `/api/greet/:name`) defines the route. Path parameters, dynamic segments of the URL, are denoted with a colon (e.g., `:name`).

### 3. Handling request data

Each endpoint method receives an `AbstractRequest` object as its argument. This object is your gateway to accessing all parts of the incoming HTTP request:

- **Path Parameters**: `request.getParams()` (e.g., `name` from `/api/greet/:name`)
- **Query Parameters**: `request.getQuery()` (e.g., `language` from `/api/greet/Boris?language=fr`)
- **Request Body**: `request.getBody()` (typically JSON data sent with POST or PUT requests)
- **Headers**: `request.getHeaders()`

### 4. Leveraging TypeScript for automatic validation & OpenAPI schema

Here's where `@alliage/rest-api` shines. By defining TypeScript types for your path parameters, query parameters, and request body, and associating them with the `AbstractRequest` object in your endpoint method, you enable powerful features:

- **Automatic Request Validation**: Incoming requests are automatically validated against these TypeScript types and any JSDOC annotations you provide (more on this later).
- **Automatic OpenAPI Schema Generation**: An OpenAPI (formerly Swagger) specification for your API is generated based on these types and JSDOCs.

The value returned by your controller method will be automatically serialized (usually to JSON) and sent as the HTTP response body.

### Example: Bringing it all together

Let's enhance our `MyController` with a `greet` endpoint and a `healthCheck` endpoint:

```typescript
// src/controllers/my-controller.ts
import {
  AbstractController,
  AbstractRequest,
  Post,
  Get,
} from "@alliage/webserver";
import { Service } from "@alliage/service-loader";

// Define types for request parts for validation and type safety
type GreetParams = {
  /**
   * The name of the person to greet.
   * @pattern "[a-zA-Z]+"
   */
  name: string;
};

type GreetQuery = {
  /**
   * Optional language for the greeting.
   * @default "en"
   */
  language?: "fr" | "en";
};

type UserDataBody = {
  /**
   * The age of the user.
   * @minimum 0
   */
  age: number;
};

@Service("my_controller")
export default class MyController extends AbstractController {
  @Post("/api/greet/:name")
  async greet(request: AbstractRequest<GreetParams, GreetQuery, UserDataBody>) {
    const name = request.getParams().name; // Get path parameter
    const lang = request.getQuery().language || "en"; // Get query parameter
    const age = request.getBody().age; // Get request body

    // JSDOC comments on types (GreetParams, GreetQuery, UserDataBody)
    // will be used for OpenAPI schema generation and validation.
    // For example, the @pattern on `name` and @minimum on `age`.

    if (lang === "fr") {
      return { message: `Bonjour ${name}, vous avez ${age} ans.` };
    }
    return { message: `Hello ${name}, you are ${age} years old.` };
  }

  @Get("/api/health")
  async healthCheck() {
    return { status: "UP" };
  }
}
```

This structure allows you to build well-defined, validated, and self-documenting REST APIs with minimal boilerplate.

## Understanding and customizing your OpenAPI schema

An OpenAPI schema is a language-agnostic definition of your REST API. It describes your endpoints, request/response formats, authentication methods, and more. `@alliage/rest-api` automates its generation, but also offers deep customization.

### How your code shapes the schema: TypeScript types and JSDOC

As seen in the `MyController` example, the TypeScript types you define for `Params`, `Query`, and `Body` (like `GreetParams`, `GreetQuery`, `UserDataBody`) are fundamental. `@alliage/rest-api` uses these types, along with JSDOC annotations within them, to infer the structure and validation rules for your API.

#### Deeper dive: JSDOC annotations on types for schema details

While TypeScript types form the basis, JSDOC annotations provide fine-grained control over the generated JSON Schema for these types. These annotations are placed directly above type properties within your `type` or `interface` definitions.

The following examples are inspired by `rest-api/src/__tests__/fixtures/types.ts`.

##### 1. Descriptions

Standard JSDOC comments on type properties become the `description` in the JSON Schema.

```typescript
type MyObject = {
  /**
   * This is a unique identifier for the item.
   * It should be a positive integer.
   */
  id: number;
  name: string; // A simple property without a detailed description
};
```

JSON Schema (property `id`):

```json
{
  "type": "number",
  "description": "This is a unique identifier for the item.\nIt should be a positive integer."
}
```

##### 2. Validation constraints

Apply common JSON Schema validation keywords using JSDOC tags:

- **For `number` types:**

  - `/** @minimum <value> */`: Sets the `minimum` inclusive value.
  - `/** @maximum <value> */`: Sets the `maximum` inclusive value.

- **For `string` types:**
  - `/** @pattern <regex> */`: The string must match the provided regular expression.

```typescript
type ValidationExample = {
  /**
   * Age of the user.
   * @minimum 18
   * @maximum 120
   */
  age: number;
};
```

JSON Schema (property `age`):

```json
{
  "type": "number",
  "description": "Age of the user.",
  "minimum": 18,
  "maximum": 120
}
```

##### 3. Ignoring properties

Use the `@ignore` tag to exclude a property from the generated JSON Schema.

```typescript
type ObjectWithIgnoredProperty = {
  /**
   * This property will not appear in the JSON schema.
   * @ignore
   */
  internalCounter: number;
  isVisible: boolean;
};
```

The `internalCounter` property will be omitted from the schema.

##### 4. Overriding schema type and format

The `@type` tag allows the JSON schema representation to differ from direct TypeScript-to-JSON-Schema inference.

- `/** @type "<jsonSchemaType>" */`: Forces the property to be represented by a specific JSON Schema type (e.g., `"string"`, `"number"`, `"integer"`, `"boolean"`).

```typescript
type SchemaOverrideExample = {
  /**
   * Represents a date. While `Date` in TS, it's a string in "DD-MM-YYYY" format in the API.
   * @type "string"
   * @pattern "^[0-9]{2}-[0-9]{2}-[0-9]{4}$"
   */
  registrationDate: Date;

  /**
   * A numeric ID that should always be treated as a string in the API.
   * @type "string"
   */
  legacyId: number;
};
```

JSON Schema (property `registrationDate`):

```json
{
  "type": "string",
  "pattern": "^[0-9]{2}-[0-9]{2}-[0-9]{4}$",
  "description": "Represents a date. While `Date` in TS, it's a string in "DD-MM-YYYY" format in the API.\nDate in DD-MM-YYYY format."
}
```

##### 5. Default values

- `/** @default <value> */`: Specifies a default value for a property.

```typescript
type WithDefault = {
  /**
   * The user's preferred language.
   * @default "en"
   */
  language: "en" | "fr" | "es";
};
```

JSON Schema (property `language`):

```json
{
  "type": "string",
  "description": "The user's preferred language.",
  "enum": ["en", "fr", "es"],
  "default": "en"
}
```

### Fine-tuning OpenAPI operations with JSDOC on controller actions

Beyond types, JSDOC annotations directly on your controller action methods (above the HTTP decorators like `@Get()`) enrich the OpenAPI Operation Object:

- `/** @description Your detailed operation description here. */`
  Sets the `description` field.
- `/** @summary A concise summary of the operation. */`
  Sets the `summary` field.
- `/** @tags tag1, tag2, another-tag */`
  Assigns comma-separated tags.
- `/** @returns Describes the successful response. */`
  Provides a description for the default successful response. (Schema from return type).
- `/** @defaultStatusCode 201 */`
  Specifies a non-standard successful HTTP status code (e.g., 201 for POST, 204 for DELETE).
  _Examples: `user-controller.ts` (`@Post("/api/users/create")` uses 201, `@Delete("/api/users/:id")` uses 204), `test3-controller.ts` (`@Post("/api/hierarchy")` uses 204)._
- `/** @operationId customOperationId */`
  Assigns a specific `operationId`.

#### Documenting error responses

To document specific error responses (e.g., 400, 401), add a JSDOC comment immediately before a call to `createHttpError(statusCode, body)` within your action method. The `statusCode`, the structure of the `body`, and the JSDOC comment (as description) will define that error response in OpenAPI.

**Example (`user-controller.ts`):**

```typescript
// ... imports and other code ...
import { createHttpError } from "@alliage/error-handler"; // Ensure this is imported
import { AbstractController, Post, AbstractRequest } from "@alliage/webserver";
import { Service } from "@alliage/service-loader";

// Define LoginPayload type if not already defined
type LoginPayload = {
  email?: string;
  password?: string;
};

@Service("user_controller")
export default class UserController extends AbstractController {
  @Post("/api/login")
  public async login(request: AbstractRequest<unknown, unknown, LoginPayload>) {
    const { email, password } = request.getBody();

    if (email !== "admin@acme.com" || password !== "qwerty") {
      /**
       * Error raised when the credentials are incorrect.
       * This JSDOC comment will describe the 401 response in OpenAPI.
       */
      throw createHttpError(401, {
        message: "Wrong credentials",
      });
    }

    return {
      token: `ACCESS_TOKEN`,
    };
  }
  // ... other methods ...
}
```

### Global OpenAPI specification settings (`rest-api-openapi-specs.yaml`)

For top-level OpenAPI fields like API info, servers, global components (schemas, security schemes), and tags, `@alliage/rest-api` uses a dedicated YAML file, typically `config/rest-api-openapi-specs.yaml`.

**Key Features:**

1.  **Global API Information**: Define title, version, description, contact, license.
2.  **Server Definitions**: Specify API server URLs.
3.  **Reusable Components**: Define global schemas, responses, parameters, etc., in `components`.
4.  **Path Merging**: Paths defined in `rest-api-openapi-specs.yaml` merge with controller-generated paths. Controller paths take precedence on overlap. Often, `paths: {}` is minimal if controllers define all routes.

**Example (`rest-api-openapi-specs.yaml`):**

```yaml
# config/rest-api-openapi-specs.yaml
openapi: 3.0.3
info:
  title: My Awesome API Title
  description: >-
    This is a longer description of what your API does.
    It can span multiple lines.
  contact:
    name: API Support Team
    url: https://www.example.com/support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
  version: "1.2.3"
servers:
  - url: http://localhost:3000/api/v1
    description: Development server
  - url: https://production.example.com/api/v1
    description: Production server
tags:
  - name: Users
    description: Operations related to user management.
  - name: Products
    description: Access to product information.
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-KEY
  schemas:
    GenericError:
      type: object
      properties:
        statusCode:
          type: integer
        message:
          type: string
        errorCode:
          type: string
          nullable: true
paths: {}
```
Populate this file according to the [OpenAPI Specification](https://swagger.io/specification/). The module merges its contents with code-derived information.

### Accessing your generated OpenAPI schema

`@alliage/rest-api` provides two main ways to get the schema:

#### 1. Via HTTP endpoint

If enabled in `rest-api.yaml` (see Configuration section, under `schema.enable` and `schema.path`), the schema is available at a URL. Typically, this is `/api/specs`.

If your app runs at `http://localhost:3000`, access the schema with:

```bash
curl http://localhost:3000/api/specs
```

This returns the JSON formatted schema.

**Configuration Snippet (`rest-api.yaml`):**

```yaml
schema:
  enable: true
  path: /api/specs # Defines the URL endpoint
```

#### 2. Using the `rest:dump-schema` command

A CLI process generates and dumps the schema to a file or stdout, useful for CI/CD or static docs.

Run via Alliage scripts runner:

```bash
# To output to stdout
npx alliage-scripts run rest:dump-schema
```

## Configuring the `@alliage/rest-api` module (`rest-api.yaml`)

The module's behavior is controlled by a `rest-api.yaml` file in your configuration directory. It manages schema generation, validation, CORS, and more.

Here's an overview based on `rest-api/integration-tests/main-scenario/config/rest-api.yaml`:

```yaml
schema:
  enable: true
  path: /api/specs
metadata:
  sources: ["src/controllers/*"] # Adjusted to a more common glob
  path: ".alliage-rest-api-metadata.json"
validation:
  requests:
    enable: true
  responses:
    enable: true
    errors:
      returnErrors: false # True in dev, false in prod is a common pattern
      statusCode: 500
allowedOrigins:
  - origin: "http://acme.com"
    headers: ["X-Custom-Header-1", "X-Custom-Header-2"]
    methods: ["GET", "POST", "PUT", "DELETE"]
    maxAge: 4800
development:
  disableMetadataGeneration: false
```

### Key configuration areas

#### `schema`
Controls OpenAPI schema generation and HTTP exposure.

- `enable` (boolean): If `true`, schema is generated and available via HTTP. Default: `true`.
- `path` (string): URL path for the schema (e.g., `/api/specs`).

#### `metadata`
Defines controller locations for schema generation and metadata storage.

- `sources` (array of strings): Glob patterns for controller files (e.g., `["src/controllers/**/*.ts"]`).
- `path` (string): Path for storing intermediate metadata (e.g., `".alliage-rest-api-metadata.json"`).

#### `validation`
Configures request and response validation.

- `requests`:
  - `enable` (boolean): If `true`, validates incoming request parameters (path, query, body) against TypeScript types and JSDOC. Default: `true`.
- `responses`:
  - `enable` (boolean): If `true`, validates outgoing responses against action return types. Default: `true`.
  - `errors`:
    - `returnErrors` (boolean): If `true`, validation error details are in HTTP response. Default: `false` (prod), `true` (dev).
    - `statusCode` (number): HTTP status for response validation failure. Default: `500`.

##### Per-action validation overrides
You can override global validation settings (`validation.requests.enable`, `validation.responses.enable`) per action using JSDOC tags in the controller action's comment block:

- `/** @validateInput false */` or `/** @validateInput true */`
  Enables/disables request validation for that action.
- `/** @validateOutput false */` or `/** @validateOutput true */`
  Enables/disables response validation for that action.

**Example (`validation-metadata-controller.ts` scenario):**

```typescript
import {
  AbstractController,
  Get,
  Post,
  AbstractRequest,
} from "@alliage/webserver";

export default class ValidationController extends AbstractController {
  /**
   * For this action, input validation is disabled, output validation is enabled.
   * @validateInput false
   * @validateOutput true
   */
  @Get("/api/get-action")
  async getAction() {
    // ... some logic ...
    return { message: "Output will be validated" };
  }

  /**
   * For this action, input validation is enabled, output validation is disabled.
   * @validateInput true
   * @validateOutput false
   */
  @Post("/api/post-action")
  async postAction(
    request: AbstractRequest<unknown, unknown, { data: string }>
  ) {
    // request.getBody().data will be validated if global validation is off but this is true
    // ... some logic ...
    return { message: "Output will not be validated" };
  }
}
```

#### `allowedOrigins` (CORS configuration)
Defines Cross-Origin Resource Sharing policy. Array of origin rule objects.

- `origin` (string or RegExp): Allowed origin (e.g., `"http://acme.com"`, `"*"` - not for prod).
- `methods` (array of strings): Allowed HTTP methods (e.g., `["GET", "POST"]`).
- `headers` (array of strings): Allowed request headers.
- `maxAge` (number, optional): `Access-Control-Max-Age` header value (seconds).
  If empty/undefined, CORS is disabled.

#### `development`
Development environment settings.

- `disableMetadataGeneration` (boolean): If `true`, skips generating `.alliage-rest-api-metadata.json`. Can speed up dev startup if API definitions aren't changing. Default: `false`.

## Listening to the API lifecycle: Events

The `@alliage/rest-api` module emits several events throughout its processes, particularly around request/response validation, error handling, and schema generation. You can listen to these events to hook into these lifecycle moments for logging, custom modifications, or other advanced behaviors.

Events are identified by the `REST_API_EVENTS` enum.

### REST API events

| Event Type                               | Event Object Class                 | Description                                                                |
| ---------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `REST_API_EVENTS.PRE_VALIDATE_REQUEST`   | `RestAPIPreValidateRequestEvent`   | Triggered before validating an incoming request.                           |
| `REST_API_EVENTS.INVALID_REQUEST`        | `RestAPIInvalidRequestEvent`       | Triggered if an incoming request fails validation.                         |
| `REST_API_EVENTS.POST_VALIDATE_REQUEST`  | `RestAPIPostValidateRequestEvent`  | Triggered after an incoming request has been successfully validated.       |
| `REST_API_EVENTS.PRE_VALIDATE_RESPONSE`  | `RestAPIPreValidateResponseEvent`  | Triggered before validating an outgoing response.                          |
| `REST_API_EVENTS.INVALID_RESPONSE`       | `RestAPIInvalidResponseEvent`      | Triggered if an outgoing response fails validation.                        |
| `REST_API_EVENTS.POST_VALIDATE_RESPONSE` | `RestAPIPostValidateResponseEvent` | Triggered after an outgoing response has been successfully validated.      |
| `REST_API_EVENTS.PRE_ERROR`              | `RestAPIPreErrorEvent`             | Triggered before an error is processed and sent to the client. (Writable)  |
| `REST_API_EVENTS.POST_ERROR`             | `RestAPIPostErrorEvent`            | Triggered after an error has been processed and sent to the client.        |
| `REST_API_EVENTS.PRE_GENERATE_SCHEMA`    | `RestAPIPreGenerateSchemaEvent`    | Triggered before the OpenAPI schema is generated from metadata. (Writable) |
| `REST_API_EVENTS.POST_GENERATE_SCHEMA`   | `RestAPIPostGenerateSchemaEvent`   | Triggered after the OpenAPI schema has been generated. (Writable)          |

#### `RestAPIPreValidateRequestEvent`

This event is triggered just before the validation logic for an incoming request's parameters, query, and body is executed. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action being processed.
- `getRequest(): AbstractRequest` - Returns the current request object.

#### `RestAPIInvalidRequestEvent`

This event is triggered when an incoming request fails validation based on the defined TypeScript types and JSDOC annotations. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action.
- `getRequest(): AbstractRequest` - Returns the current request object.
- `getErrors(): ValidationErrors[]` - Returns an array of validation errors.

#### `RestAPIPostValidateRequestEvent`

This event is triggered after an incoming request has successfully passed all validation checks. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action.
- `getRequest(): AbstractRequest` - Returns the current request object.

#### `RestAPIPreValidateResponseEvent`

This event is triggered before the validation logic for an outgoing response body is executed against the action's return type. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action.
- `getResponse(): AbstractResponse` - Returns the current response object.

#### `RestAPIInvalidResponseEvent`

This event is triggered if an outgoing response body fails validation. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action.
- `getResponse(): AbstractResponse` - Returns the current response object.
- `getErrors(): ValidationErrors[]` - Returns an array of validation errors.

#### `RestAPIPostValidateResponseEvent`

This event is triggered after an outgoing response has successfully passed validation. It is not writable.
Available methods for this event:

- `getMetadata(): ActionMetadata` - Returns the metadata for the controller action.
- `getResponse(): AbstractResponse` - Returns the current response object.

#### `RestAPIPreErrorEvent`

This event is triggered when an error occurs during request processing, before the error response is finalized and sent to the client. This event is **writable**, allowing modification of the HTTP status code and response body of the error.
Available methods for this event:

- `getRequest(): AbstractRequest` - Returns the current request object.
- `getError(): Error` - Returns the original error object that was thrown.
- `getCode(): number` - Returns the current HTTP status code for the error response.
- `getBody(): JSONObject` - Returns the current body for the error response.
- `setCode(code: number): this` - Sets a new HTTP status code for the error response.
- `setBody(body: JSONObject): this` - Sets a new body for the error response.

#### `RestAPIPostErrorEvent`

This event is triggered after the error response has been constructed and sent to the client. It is not writable.
Available methods for this event:

- `getRequest(): AbstractRequest` - Returns the current request object.
- `getError(): Error` - Returns the original error object.
- `getCode(): number` - Returns the HTTP status code that was used for the error response.
- `getBody(): JSONObject` - Returns the body that was sent in the error response.

#### `RestAPIPreGenerateSchemaEvent`

This event is triggered before the OpenAPI schema is generated from the collected controller metadata. This event is **writable**, allowing modification of the metadata before schema generation.
Available methods for this event:

- `getMetadata(): Metadata` - Returns the complete metadata collected from all controllers.
- `setMetadata(metadata: Metadata): this` - Allows replacing the metadata that will be used for schema generation.

#### `RestAPIPostGenerateSchemaEvent`

This event is triggered after the OpenAPI schema has been generated. This event is **writable**, allowing modification of the final schema before it's used or served.
Available methods for this event:

- `getMetadata(): Metadata` - Returns the metadata used for schema generation.
- `getSchema(): OpenApiSpecs` - Returns the generated OpenAPI schema.
- `setSchema(schema: OpenApiSpecs): this` - Allows replacing the generated OpenAPI schema.

## Optimizing for production: Pre-generating controller metadata

For faster server startups, `@alliage/rest-api` allows pre-generating controller metadata during a build step using `@alliage/builder`.

### Benefits
- **Faster Server Startup**: Avoids on-the-fly parsing at launch.
- **Build-time Validation**: Catches some schema errors early.

### Configuration (`config/builder.yaml`)
Define the `rest-generate-schema` task in `config/builder.yaml`:

```yaml
# config/builder.yaml
tasks:
  - name: rest-generate-schema
    description: Generates REST API controller metadata and OpenAPI schema components.
    params: {}
```

### How it works
1.  **Add `@alliage/builder`**:
    ```bash
    yarn add --dev @alliage/builder
    # or
    npm install --save-dev @alliage/builder
    ```
2.  **Configure `builder.yaml`**: Add the task as above. It uses `metadata.sources` and `metadata.path` from `rest-api.yaml`.
3.  **Run Build**: Execute Alliage builder (e.g., via npm script):
    ```json
    // package.json
    {
      "scripts": {
        "build": "alliage-scripts build"
      }
    }
    ```
    Running `yarn build` or `npm run build` executes the task.
4.  **Runtime Usage**: If the metadata file (e.g., `.alliage-rest-api-metadata.json`) exists at runtime, `@alliage/rest-api` loads it, bypassing parsing.

**Crucial for Production**: Ensure this metadata file is generated and deployed. If missing in production (and `development.disableMetadataGeneration` isn't `true` allowing fallback for dev convenience), the module won't generate it on-the-fly, leading to incomplete/empty schema and potentially non-functional API endpoints. In development (if `development.disableMetadataGeneration` is `false`), it falls back to on-the-fly generation if the file is missing.
