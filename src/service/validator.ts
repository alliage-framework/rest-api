import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { AbstractRequest, AbstractResponse } from "@alliage/webserver";

import { ActionMetadata } from "./metadata-manager";

interface ActionValidator {
  request: {
    params: ValidateFunction;
    query: ValidateFunction;
    body: ValidateFunction;
  };
  response: {
    body: ValidateFunction;
  };
}

export enum ERROR_SOURCE {
  BODY = "body",
  PARAMS = "params",
  QUERY = "query",
}

export type ValidationErrors = {
  source: ERROR_SOURCE;
  errors: ValidateFunction["errors"];
};

export class Validator {
  private actionValidators = new Map<ActionMetadata, ActionValidator>();
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ coerceTypes: true, allErrors: true, logger: false });
    addFormats(this.ajv);
  }

  private getActionValidators(metadata: ActionMetadata) {
    let actionValidator = this.actionValidators.get(metadata);
    if (actionValidator) {
      return actionValidator;
    }

    actionValidator = {
      request: {
        params: this.ajv.compile(metadata.paramsType),
        query: this.ajv.compile(metadata.queryType),
        body: this.ajv.compile(metadata.bodyType),
      },
      response: {
        body: this.ajv.compile(metadata.returnType),
      },
    };
    this.actionValidators.set(metadata, actionValidator);
    return actionValidator;
  }

  /**
   * Validate a request against the given metadata
   * @param metadata metadata containing validation schemas
   * @param request request to validate
   * @returns
   */
  validateRequest(
    metadata: ActionMetadata,
    request: AbstractRequest
  ): ValidationErrors[] | undefined {
    const { request: requestValidator } = this.getActionValidators(metadata);

    const errors = [];
    if (!requestValidator.body(request.getBody())) {
      errors.push({
        source: ERROR_SOURCE.BODY,
        errors: requestValidator.body.errors,
      });
    }
    if (!requestValidator.params(request.getParams())) {
      errors.push({
        source: ERROR_SOURCE.PARAMS,
        errors: requestValidator.params.errors,
      });
    }
    if (!requestValidator.query(request.getQuery())) {
      errors.push({
        source: ERROR_SOURCE.QUERY,
        errors: requestValidator.query.errors,
      });
    }

    if (errors.length) {
      return errors;
    }
    return undefined;
  }

  /**
   * Validate a response against the given metadata
   * @param metadata metadata containing validation schemas
   * @param response response to validate
   * @returns
   */
  validateResponse(
    metadata: ActionMetadata,
    response: AbstractResponse
  ): ValidationErrors[] | undefined {
    const { response: responseValidator } = this.getActionValidators(metadata);

    const errors = [];
    if (!responseValidator.body(response.getBody())) {
      errors.push({
        source: ERROR_SOURCE.BODY,
        errors: responseValidator.body.errors,
      });
    }

    if (errors.length) {
      return errors;
    }
    return undefined;
  }
}
