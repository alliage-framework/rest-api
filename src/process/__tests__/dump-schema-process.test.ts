import { describe, it, expect, afterEach, vi, type Mock } from "vitest";
import { DumpSchemaProcess } from "../dump-schema-process.js";
import { SchemaGenerator } from "../../service/schema-generator.js";

describe("process/dump-schema-process", () => {
  describe("DumpSchemaProcess", () => {
    const schemaGeneratorMock = {
      loadMetadata: vi.fn(),
      getSchema: vi.fn(),
    } as unknown as SchemaGenerator;

    const dumpSchemaProcess = new DumpSchemaProcess(schemaGeneratorMock);

    afterEach(() => {
      vi.restoreAllMocks();
      vi.resetAllMocks();
    });

    describe("#getName", () => {
      it("should return the name of the process", () => {
        expect(dumpSchemaProcess.getName()).toEqual("rest:dump-schema");
      });
    });

    describe("#execute", () => {
      it("should load the metadata and output the schema", async () => {
        (schemaGeneratorMock.loadMetadata as Mock).mockResolvedValueOnce(
          undefined
        );
        (schemaGeneratorMock.getSchema as Mock).mockResolvedValueOnce({
          test: "DUMMY_SCHEMA",
        });

        const writeMock = vi.spyOn(process.stdout, "write");
        const res = await dumpSchemaProcess.execute();

        expect(schemaGeneratorMock.loadMetadata).toHaveBeenCalled();
        expect(schemaGeneratorMock.getSchema).toHaveBeenCalled();
        expect(writeMock).toHaveBeenCalledWith(
          '{\n  "test": "DUMMY_SCHEMA"\n}'
        );
        expect(res).toBe(true);
      });
    });
  });
});
