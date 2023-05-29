import fs from "fs";

import { Sandbox } from "@alliage/sandbox";
import { WebserverSandbox } from "@alliage/webserver-sandbox";

describe("Main scenario", () => {
  const sandbox = new Sandbox({
    scenarioPath: __dirname,
  });

  const METADATA_PATH = `${sandbox.getPath()}/.alliage-rest-api-metadata.json`;

  const webserverSandbox = new WebserverSandbox(sandbox);

  beforeAll(async () => {
    try {
      await sandbox.init();
    } catch (e) {
      console.error(e);
    }
  });

  afterAll(async () => {
    await sandbox.clear();
  });

  describe("Schema generation", () => {
    beforeEach(() => {
      if (fs.existsSync(METADATA_PATH)) {
        fs.unlinkSync(METADATA_PATH);
      }
    });

    describe("With process", () => {
      it("should generate a schema from the controllers types", async () => {
        const p = await sandbox.run(["rest:generate-schema"]);
        await p.waitCompletion();

        const schema = fs.readFileSync(METADATA_PATH).toString();

        expect(JSON.parse(schema)).toMatchSnapshot();
      }, 8000);
    });

    describe("With builder task", () => {
      it("should generate a schema from the controllers types", async () => {
        const p = await sandbox.build([]);
        await p.waitCompletion();

        const schema = fs.readFileSync(METADATA_PATH).toString();

        expect(JSON.parse(schema)).toMatchSnapshot();
      }, 8000);
    });
  });

  describe("Rest API", () => {
    beforeAll(async () => {
      try {
        await webserverSandbox.start();
      } catch (e) {
        console.error(e);
        process.exit(-1);
      }
    }, 8000);

    afterAll(async () => {
      await webserverSandbox.stop();
    });

    it("should provide a OpenAPI spec", async () => {
      const res = await webserverSandbox.getClient().get("/api/specs");

      expect(res.status).toEqual(200);
      expect(res.data).toMatchSnapshot();
    });

    it("should say hello in french", async () => {
      const res = await webserverSandbox
        .getClient()
        .post("/api/hello/Jean?language=fr", { age: 42 });

      expect(res.status).toEqual(200);
      expect(res.data).toEqual({ message: "Bonjour Jean, tu as 42 ans" });
    });

    it("should say hello in english", async () => {
      const res = await webserverSandbox
        .getClient()
        .post("/api/hello/John?language=en", { age: 26 });

      expect(res.status).toEqual(200);
      expect(res.data).toEqual({ message: "Hello John, you are 26" });
    });

    it("should return an error when the body is invalid", async () => {
      const res = await webserverSandbox
        .getClient()
        .post(
          "/api/hello/John?language=fr",
          { age: "twenty-six" },
          { validateStatus: () => true }
        );

      expect(res.status).toEqual(400);
      expect(res.data).toEqual([
        {
          errors: [
            {
              instancePath: "/age",
              keyword: "type",
              message: "must be number",
              params: { type: "number" },
              schemaPath: "#/properties/age/type",
            },
          ],
          source: "body",
        },
      ]);
    });

    it("should return an error when the params are invalid", async () => {
      const res = await webserverSandbox
        .getClient()
        .post(
          "/api/hello/42?language=fr",
          { age: 26 },
          { validateStatus: () => true }
        );

      expect(res.status).toEqual(400);
      expect(res.data).toEqual([
        {
          errors: [
            {
              instancePath: "/name",
              keyword: "pattern",
              message: 'must match pattern "[a-zA-Z]+"',
              params: { pattern: "[a-zA-Z]+" },
              schemaPath: "#/properties/name/pattern",
            },
          ],
          source: "params",
        },
      ]);
    });

    it("should return an error when the query is invalid", async () => {
      const res = await webserverSandbox
        .getClient()
        .post(
          "/api/hello/John?language=it",
          { age: 26 },
          { validateStatus: () => true }
        );

      expect(res.status).toEqual(400);
      expect(res.data).toEqual([
        {
          errors: [
            {
              instancePath: "/language",
              keyword: "enum",
              message: "must be equal to one of the allowed values",
              params: { allowedValues: ["fr", "en"] },
              schemaPath: "#/properties/language/enum",
            },
          ],
          source: "query",
        },
      ]);
    });

    it("should handle preflight requests", async () => {
      const res = await webserverSandbox
        .getClient()
        .options("/api/hello/John", {
          headers: {
            "Access-Control-Request-Method": "",
            "Access-Control-Request-Headers": "",
            Origin: "http://acme.com",
          },
        });

      expect(res.status).toBe(204);
      expect(res.headers).toEqual(
        expect.objectContaining({
          "access-control-allow-origin": "http://acme.com",
          "access-control-allow-headers":
            "X-Custom-Header-1, X-Custom-Header-2",
          "access-control-allow-methods": "GET, POST, PUT, DELETE",
          "access-control-max-age": "4800",
        })
      );
    });
  });
});
