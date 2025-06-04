import { OpenAPIV31 } from "../generated/schemas/v3.1.js";
import openapiSchema from "../generated/schemas/v3.1.json" with { type: "json" };

export const CONFIG_NAME = "rest-api-openapi-specs";

export const schema = openapiSchema;

export type Config = OpenAPIV31;
