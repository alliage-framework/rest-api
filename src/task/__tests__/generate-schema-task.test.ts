import path from "path";
import fs from "fs";

import { MetadataManager } from "../../service/metadata-manager";
import { GenerateSchemaTask } from "../../task/generate-schema-task";

const METADATA_PATH = `/tmp/${path.basename(__filename)}.metadata.json`;

describe("process/generate-schema-process", () => {
  describe("GenerateSchemaProcess", () => {
    const metadataManager = new MetadataManager(
      "production",
      [
        path.resolve(
          `${__dirname}/../../__tests__/fixtures/controllers/test1-controller.ts`
        ),
      ],
      METADATA_PATH,
      false,
      path.resolve(`${__dirname}/../../__tests__/fixtures/tsconfig.json`)
    );
    const task = new GenerateSchemaTask(metadataManager);

    describe("#getName", () => {
      it("should return the name of the process", () => {
        expect(task.getName()).toBe("rest-generate-schema");
      });
    });

    describe("#execute", () => {
      it("should generate the schema", async () => {
        await task.run();

        expect(fs.existsSync(METADATA_PATH)).toBe(true);

        const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
        expect(metadata).toEqual({
          post: [
            {
              actionMetadata: {
                bodyType: {
                  additionalProperties: false,
                  properties: {
                    age: {
                      type: "number",
                    },
                  },
                  required: ["age"],
                  type: "object",
                },
                controllerName: "Test1Controller",
                defaultStatusCode: 200,
                errors: [
                  {
                    code: "400",
                    description: "Error raised when the user is not an adult",
                    payloadType: {
                      additionalProperties: false,
                      properties: {
                        message: {
                          type: "string",
                        },
                        minimumAge: {
                          type: "number",
                        },
                      },
                      required: ["message", "minimumAge"],
                      type: "object",
                    },
                  },
                ],
                name: "checkAge",
                paramsType: {},
                queryType: {
                  additionalProperties: false,
                  properties: {
                    country: {
                      type: "string",
                    },
                  },
                  required: ["country"],
                  type: "object",
                },
                returnType: {
                  additionalProperties: false,
                  properties: {
                    message: {
                      type: "string",
                    },
                  },
                  required: ["message"],
                  type: "object",
                },
                validateInput: true,
                validateOutput: true,
              },
              path: "/api/check-age",
              pattern: "/^\\/api\\/check-age[\\/#\\?]?$/i",
            },
          ],
        });
      });
    });
  });
});
