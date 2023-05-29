import { AbstractEvent, AbstractWritableEvent } from "@alliage/lifecycle";
import { AbstractRequest, AbstractResponse } from "@alliage/webserver";

import { ActionMetadata, Metadata } from "./service/metadata-manager";
import { ValidationErrors } from "./service/validator";
import { Config as OpenApiSpecs } from "./config/openapi-specs";

export enum REST_API_EVENTS {
  PRE_VALIDATE_REQUEST = "@rest-api/REST_API_EVENTS/PRE_VALIDATE_REQUEST",
  INVALID_REQUEST = "@rest-api/REST_API_EVENTS/INVALID_REQUEST",
  POST_VALIDATE_REQUEST = "@rest-api/REST_API_EVENTS/POST_VALIDATE_REQUEST",

  PRE_VALIDATE_RESPONSE = "@rest-api/REST_API_EVENTS/PRE_VALIDATE_RESPONSE",
  INVALID_RESPONSE = "@rest-api/REST_API_EVENTS/INVALID_RESPONSE",
  POST_VALIDATE_RESPONSE = "@rest-api/REST_API_EVENTS/POST_VALIDATE_RESPONSE",

  PRE_ERROR = "@rest-api/REST_API_EVENTS/PRE_ERROR",
  POST_ERROR = "@rest-api/REST_API_EVENTS/POST_ERROR",

  PRE_GENERATE_SCHEMA = "@rest-api/REST_API_EVENTS/PRE_GENERATE_SCHEMA",
  POST_GENERATE_SCHEMA = "@rest-api/REST_API_EVENTS/POST_GENERATE_SCHEMA",
}

interface RestAPIValidateRequestEventPayload {
  metadata: ActionMetadata;
  request: AbstractRequest;
}

class AbstractValidateRequestEvent<
  P extends RestAPIValidateRequestEventPayload
> extends AbstractEvent<REST_API_EVENTS, P> {
  getMetadata() {
    return Object.freeze(this.getPayload().metadata);
  }

  getRequest() {
    return this.getPayload().request;
  }
}

export type RestAPIPreValidateRequestEventPayload =
  RestAPIValidateRequestEventPayload;

export class RestAPIPreValidateRequestEvent extends AbstractValidateRequestEvent<RestAPIPreValidateRequestEventPayload> {
  constructor(metadata: ActionMetadata, request: AbstractRequest) {
    super(REST_API_EVENTS.PRE_VALIDATE_REQUEST, { metadata, request });
  }

  static getParams(metadata: ActionMetadata, request: AbstractRequest) {
    return super.getParams(metadata, request);
  }
}

export interface RestAPIInvalidRequestEventPayload
  extends RestAPIValidateRequestEventPayload {
  errors: ValidationErrors[];
}

export class RestAPIInvalidRequestEvent extends AbstractValidateRequestEvent<RestAPIInvalidRequestEventPayload> {
  constructor(
    metadata: ActionMetadata,
    request: AbstractRequest,
    errors: ValidationErrors[]
  ) {
    super(REST_API_EVENTS.INVALID_REQUEST, { metadata, request, errors });
  }

  getErrors() {
    return Object.freeze(this.getPayload().errors);
  }

  static getParams(
    metadata: ActionMetadata,
    request: AbstractRequest,
    errors: ValidationErrors[]
  ) {
    return super.getParams(metadata, request, errors);
  }
}

export type RestAPIPostValidateRequestEventPayload =
  RestAPIValidateRequestEventPayload;

export class RestAPIPostValidateRequestEvent extends AbstractValidateRequestEvent<RestAPIPostValidateRequestEventPayload> {
  constructor(metadata: ActionMetadata, request: AbstractRequest) {
    super(REST_API_EVENTS.POST_VALIDATE_REQUEST, { metadata, request });
  }

  static getParams(metadata: ActionMetadata, request: AbstractRequest) {
    return super.getParams(metadata, request);
  }
}

interface RestAPIValidateResponseEventPayload {
  metadata: ActionMetadata;
  response: AbstractResponse;
}

class AbstractValidateResponseEvent<
  P extends RestAPIValidateResponseEventPayload
> extends AbstractEvent<REST_API_EVENTS, P> {
  getMetadata() {
    return Object.freeze(this.getPayload().metadata);
  }

  getResponse() {
    return this.getPayload().response;
  }
}

export type RestAPIPreValidateResponseEventPayload =
  RestAPIValidateResponseEventPayload;

export class RestAPIPreValidateResponseEvent extends AbstractValidateResponseEvent<RestAPIPreValidateResponseEventPayload> {
  constructor(metadata: ActionMetadata, response: AbstractResponse) {
    super(REST_API_EVENTS.PRE_VALIDATE_RESPONSE, { metadata, response });
  }

  static getParams(metadata: ActionMetadata, response: AbstractResponse) {
    return super.getParams(metadata, response);
  }
}

export interface RestAPIInvalidResponseEventPayload
  extends RestAPIValidateResponseEventPayload {
  errors: ValidationErrors[];
}

export class RestAPIInvalidResponseEvent extends AbstractValidateResponseEvent<RestAPIInvalidResponseEventPayload> {
  constructor(
    metadata: ActionMetadata,
    response: AbstractResponse,
    errors: ValidationErrors[]
  ) {
    super(REST_API_EVENTS.INVALID_RESPONSE, { metadata, response, errors });
  }

  getErrors() {
    return Object.freeze(this.getPayload().errors);
  }

  static getParams(
    metadata: ActionMetadata,
    response: AbstractResponse,
    errors: ValidationErrors[]
  ) {
    return super.getParams(metadata, response, errors);
  }
}

export type RestAPIPostValidateResponseEventPayload =
  RestAPIValidateResponseEventPayload;

export class RestAPIPostValidateResponseEvent extends AbstractValidateResponseEvent<RestAPIPostValidateResponseEventPayload> {
  constructor(metadata: ActionMetadata, response: AbstractResponse) {
    super(REST_API_EVENTS.POST_VALIDATE_RESPONSE, { metadata, response });
  }

  static getParams(metadata: ActionMetadata, response: AbstractResponse) {
    return super.getParams(metadata, response);
  }
}

interface RestAPIErrorEventPayload {
  request: AbstractRequest;
  error: Error;
  code: number;
  body: JSONObject;
}

type Primitive = bigint | boolean | null | number | string | symbol | undefined;

type JSONValue = Primitive | JSONObject | JSONArray;

interface JSONObject {
  [key: string]: JSONValue;
}

type JSONArray = Array<JSONValue>;

export type RestAPIPreErrorEventPayload = RestAPIErrorEventPayload;

export class RestAPIPreErrorEvent extends AbstractWritableEvent<
  REST_API_EVENTS,
  RestAPIPreErrorEventPayload
> {
  constructor(
    request: AbstractRequest,
    error: Error,
    code: number,
    body: JSONObject
  ) {
    super(REST_API_EVENTS.PRE_ERROR, { request, error, code, body });
  }

  getRequest() {
    return this.getPayload().request;
  }

  getError() {
    return this.getPayload().error;
  }

  getCode() {
    return this.getWritablePayload().code;
  }

  getBody() {
    return Object.freeze(this.getWritablePayload().body);
  }

  setCode(code: number) {
    this.getWritablePayload().code = code;
    return this;
  }

  setBody(body: JSONObject) {
    this.getWritablePayload().body = body;
    return this;
  }
}

export type RestAPIPostErrorEventPayload = RestAPIErrorEventPayload;

export class RestAPIPostErrorEvent extends AbstractEvent<
  REST_API_EVENTS,
  RestAPIPreErrorEventPayload
> {
  constructor(
    request: AbstractRequest,
    error: Error,
    code: number,
    body: JSONObject
  ) {
    super(REST_API_EVENTS.POST_ERROR, { request, error, code, body });
  }

  getRequest() {
    return this.getPayload().request;
  }

  getError() {
    return this.getPayload().error;
  }

  getCode() {
    return this.getPayload().code;
  }

  getBody() {
    return Object.freeze(this.getPayload().body);
  }
}

export interface RestAPIPreGenerateSchemaEventPayload {
  metadata: Metadata;
}

export class RestAPIPreGenerateSchemaEvent extends AbstractWritableEvent<
  REST_API_EVENTS,
  RestAPIPreGenerateSchemaEventPayload
> {
  constructor(metadata: Metadata) {
    super(REST_API_EVENTS.PRE_GENERATE_SCHEMA, { metadata });
  }

  getMetadata() {
    return Object.freeze(this.getWritablePayload().metadata);
  }

  setMetadata(metadata: Metadata) {
    this.getWritablePayload().metadata = metadata;
    return this;
  }
}

export interface RestAPIPostGenerateSchemaEventPayload {
  metadata: Metadata;
  schema: OpenApiSpecs;
}

export class RestAPIPostGenerateSchemaEvent extends AbstractWritableEvent<
  REST_API_EVENTS,
  RestAPIPostGenerateSchemaEventPayload
> {
  constructor(metadata: Metadata, schema: OpenApiSpecs) {
    super(REST_API_EVENTS.POST_GENERATE_SCHEMA, { metadata, schema });
  }

  getMetadata() {
    return Object.freeze(this.getPayload().metadata);
  }

  getSchema() {
    return Object.freeze(this.getWritablePayload().schema);
  }

  setSchema(schema: OpenApiSpecs) {
    this.getWritablePayload().schema = schema;
    return this;
  }
}
