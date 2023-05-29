import cloneDeep from "lodash.clonedeep";

import openapiSchema from "../generated/schemas/v3.0";
import { HttpsSpecOpenapisOrgOas30Schema20210928 } from "../generated/schemas/v3.0.d";

export const CONFIG_NAME = "rest-api-openapi-specs";

// Fix schema to make it work with AJV
export const schema = cloneDeep(openapiSchema);
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
schema.$schema = undefined;
// @ts-ignore
schema.definitions.Schema.properties.multipleOf.exclusiveMinimum = 0;
/* eslint-enable @typescript-eslint/ban-ts-comment */

export type Config = HttpsSpecOpenapisOrgOas30Schema20210928;
