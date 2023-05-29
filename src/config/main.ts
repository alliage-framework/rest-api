import { FromSchema } from "json-schema-to-ts";

export const CONFIG_NAME = "rest-api";

export const schema = {
  additionalProperties: false,
  properties: {
    schema: {
      type: "object",
      properties: {
        enable: {
          type: "boolean",
        },
        path: {
          type: "string",
        },
      },
      required: ["enable", "path"],
      additionalProperties: false,
    },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["sources", "path"],
      properties: {
        sources: {
          type: "array",
          items: {
            type: "string",
          },
        },
        path: {
          type: "string",
        },
      },
    },
    allowedOrigins: {
      items: {
        additionalProperties: false,
        properties: {
          headers: {
            items: {
              type: "string",
            },
            type: "array",
          },
          maxAge: {
            type: "number",
          },
          methods: {
            items: {
              type: "string",
            },
            type: "array",
          },
          origin: {
            type: "string",
          },
        },
        required: ["origin"],
        type: "object",
      },
      type: "array",
    },
    development: {
      additionalProperties: false,
      properties: {
        disableMetadataGeneration: {
          type: "boolean",
        },
      },
      required: ["disableMetadataGeneration"],
      type: "object",
    },
    validation: {
      additionalProperties: false,
      properties: {
        requests: {
          additionalProperties: false,
          properties: {
            enable: {
              type: "boolean",
            },
          },
          required: ["enable"],
          type: "object",
        },
        responses: {
          additionalProperties: false,
          properties: {
            enable: {
              type: "boolean",
            },
            errors: {
              additionalProperties: false,
              properties: {
                returnErrors: {
                  type: "boolean",
                },
                statusCode: {
                  type: "number",
                },
              },
              required: ["returnErrors", "statusCode"],
              type: "object",
            },
          },
          required: ["enable", "errors"],
          type: "object",
        },
      },
      required: ["requests", "responses"],
      type: "object",
    },
  },
  required: ["schema", "metadata", "validation", "development"],
  type: "object",
} as const;

export type Config = FromSchema<typeof schema>;
