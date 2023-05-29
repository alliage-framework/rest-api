import path from "path";
import fs from "fs";

import { MetadataManager } from "../metadata-manager";

const METADATA_PATH = `/tmp/${path.basename(__filename)}.metadata.json`;

function createMetadataManager({
  environment = "production",
  sources = [
    path.resolve(
      __dirname,
      "../../__tests__/fixtures/controllers/user-controller.ts"
    ),
  ],
  metadataPath = METADATA_PATH,
  disableMetadataGeneration = false,
  tsConfigPath = path.resolve(
    __dirname,
    "../../__tests__/fixtures/tsconfig.json"
  ),
} = {}) {
  return new MetadataManager(
    environment,
    sources,
    metadataPath,
    disableMetadataGeneration,
    tsConfigPath
  );
}

describe("service/metadata-manager", () => {
  describe("MetadataManager", () => {
    describe("#generateMetadata / #getMetadata", () => {
      const metadataManager = createMetadataManager();

      beforeAll(async () => {
        await metadataManager.generateMetadata();
      });

      afterAll(() => {
        if (fs.existsSync(METADATA_PATH)) {
          fs.unlinkSync(METADATA_PATH);
        }
      });

      it("should enable to get the metadata", () => {
        const metadata = JSON.parse(fs.readFileSync(METADATA_PATH).toString());
        expect(metadataManager.getMetadata()).toEqual(metadata);
      });

      it("should throw an error if the metadata have not been loaded first", async () => {
        const unloadedMetadataManager = createMetadataManager();

        expect(() => unloadedMetadataManager.getMetadata()).toThrow(
          "Controllers metadata is not loaded"
        );
      });
    });

    describe("#loadMetadata", () => {
      describe("Production environement", () => {
        const metadataManager = createMetadataManager();
        let metadata = {};

        beforeAll(async () => {
          // We generate metadata from a different instance
          const tmpMetadataManager = createMetadataManager();
          await tmpMetadataManager.generateMetadata();
          metadata = JSON.parse(fs.readFileSync(METADATA_PATH).toString());
        });

        afterAll(() => {
          fs.unlinkSync(METADATA_PATH);
        });

        it("should load metadata from a file only", async () => {
          const spy = jest.spyOn(metadataManager, "generateMetadata");

          await metadataManager.loadMetadata();
          expect(spy).not.toHaveBeenCalled();
          expect(metadataManager.getMetadata()).toEqual(metadata);

          spy.mockRestore();
        });
      });

      describe("Development environement", () => {
        afterAll(() => {
          fs.unlinkSync(METADATA_PATH);
        });

        it("should trigger metadata generation if it's not disabled", async () => {
          const metadataManager = createMetadataManager({
            environment: "development",
          });
          const spy = jest.spyOn(metadataManager, "generateMetadata");

          await metadataManager.loadMetadata();
          expect(spy).toHaveBeenCalled();

          spy.mockRestore();
        });

        it("should load directly from a file if metadata generation is disabled", async () => {
          const metadataManager = createMetadataManager({
            environment: "development",
            disableMetadataGeneration: true,
          });
          const spy = jest.spyOn(metadataManager, "generateMetadata");

          await metadataManager.loadMetadata();
          expect(spy).not.toHaveBeenCalled();

          spy.mockRestore();
        });
      });
    });

    describe("#findMetadata", () => {
      const metadataManager = createMetadataManager();

      beforeAll(async () => {
        await metadataManager.generateMetadata();
      });

      it("should return the metadata for the given request", () => {
        const metadata = metadataManager.findMetadata("GET", "/api/users/2");

        expect(metadata).toEqual(
          expect.objectContaining({
            controllerName: "UserController",
            name: "getUser",
          })
        );
      });

      it("should return undefined if no corresponding metata is found", () => {
        const metadata = metadataManager.findMetadata(
          "OPTION",
          "/api/whatever"
        );

        expect(metadata).toBe(undefined);
      });

      it("should return undefined if the route pattern in the metadata is invalid", async () => {
        fs.writeFileSync(
          METADATA_PATH,
          JSON.stringify({
            get: [
              {
                pattern: "^/\\/api\\/users(?:\\/([^\\/#\\?]+?))[\\/#\\?]?/xyz",
                path: "/api/users/:id",
                actionMetadata: {},
              },
            ],
          })
        );

        await metadataManager.loadMetadata();
        const metadata = metadataManager.findMetadata("GET", "/api/users/2");
        expect(metadata).toBe(undefined);
      });

      it("should throw an error if the metadata is not loaded", () => {
        const notLoadedMetadataManager = createMetadataManager();

        expect(() =>
          notLoadedMetadataManager.findMetadata("GET", "/api/users/2")
        ).toThrow("Controllers metadata is not loaded");
      });
    });

    describe("Metadata extraction", () => {
      describe("Edge cases", () => {
        it("should not generate metadata for a controller that extends a class without declaration", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-definition-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(metadataManager.getMetadata()).toEqual({});
        });

        it("should not generate metadata for actions without decorator", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-decorator-definition-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(metadataManager.getMetadata()).toEqual({
            // Only one action out of two has metadata generated
            post: [
              {
                actionMetadata: {
                  bodyType: {},
                  controllerName: "NoDecoratorDefinitionController",
                  defaultStatusCode: 200,
                  errors: [],
                  name: "postAction",
                  paramsType: {},
                  queryType: {},
                  returnType: {
                    additionalProperties: false,
                    type: "object",
                  },
                  validateInput: true,
                  validateOutput: true,
                },
                path: "/api/post-action",
                pattern: "/^\\/api\\/post-action[\\/#\\?]?$/i",
              },
            ],
          });
        });

        it("should not generate metadata for errors that are not classes or instance of HttpError", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-http-error-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(
            metadataManager.findMetadata("POST", "/api/post-action")?.errors
          ).toEqual([
            // Only the proper error is returned
            {
              code: "400",
              description: undefined,
              payloadType: {
                additionalProperties: false,
                properties: {
                  message: {
                    type: "string",
                  },
                },
                required: ["message"],
                type: "object",
              },
            },
          ]);
        });

        it("should return a 500 error code for errors using non-litteral numbers as error code", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-number-litteral-error-code-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(
            metadataManager.findMetadata("GET", "/api/get-action")?.errors
          ).toEqual([
            {
              code: "500",
              description: undefined,
              payloadType: {
                additionalProperties: false,
                properties: {
                  message: { type: "string" },
                },
                required: ["message"],
                type: "object",
              },
            },
          ]);
        });

        it("should not generate metadata for controller that are not classes", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-class-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(metadataManager.getMetadata()).toEqual({});
        });

        it("should not generate returnType metadata if the action does not return a promise", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-promise-action-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(
            metadataManager.findMetadata("POST", "/api/post-action")?.returnType
          ).toEqual({});
        });

        it("should return 200 as status code if the metadata is not a valid number", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/invalid-status-code-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(
            metadataManager.findMetadata("GET", "/api/get-action")
              ?.defaultStatusCode
          ).toEqual(200);
        });

        it("should not return any metadata if there's no default export", async () => {
          const metadataManager = createMetadataManager({
            sources: [
              path.resolve(
                __dirname,
                "../../__tests__/fixtures/controllers/no-default-export-controller.ts"
              ),
            ],
          });

          await metadataManager.generateMetadata();
          expect(metadataManager.getMetadata()).toEqual({});
        });

        it("should use the tsconfig.json file at the root of the project by default", async () => {
          const ProjectMock = jest.fn().mockImplementationOnce(() => ({
            getSourceFiles: () => [],
          }));

          jest.doMock("ts-morph", () => ({
            ...(jest.requireActual("ts-morph") as object),
            Project: ProjectMock,
          }));

          jest.resetModules();
          const AlteredMetadataManager: typeof MetadataManager =
            jest.requireActual("../metadata-manager").MetadataManager;

          const alteredMetadataManager = new AlteredMetadataManager(
            "production",
            [],
            METADATA_PATH,
            false
          );

          await alteredMetadataManager.generateMetadata();

          expect(ProjectMock).toHaveBeenCalledWith({
            tsConfigFilePath: path.resolve("./tsconfig.json"),
          });

          jest.dontMock("ts-morph");
        });
      });

      describe("Validation metadata", () => {
        const metadataManager = createMetadataManager({
          sources: [
            path.resolve(
              __dirname,
              "../../__tests__/fixtures/controllers/validation-metadata-controller.ts"
            ),
          ],
        });

        beforeAll(async () => {
          await metadataManager.generateMetadata();
        });

        it("should extract action input validation metadata", () => {
          expect(
            metadataManager.findMetadata("GET", "/api/get-action")
              ?.validateInput
          ).toBe(false);
          expect(
            metadataManager.findMetadata("POST", "/api/post-action")
              ?.validateInput
          ).toBe(true);
        });

        it("should extract output validation metadata", () => {
          expect(
            metadataManager.findMetadata("GET", "/api/get-action")
              ?.validateOutput
          ).toBe(true);
          expect(
            metadataManager.findMetadata("POST", "/api/post-action")
              ?.validateOutput
          ).toBe(false);
        });
      });
    });
  });
});
