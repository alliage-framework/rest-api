import { DumpSchemaProcess } from "../dump-schema-process";
import { SchemaGenerator } from "../../service/schema-generator";

describe("process/dump-schema-process", () => {
  describe("DumpSchemaProcess", () => {
    const schemaGeneratorMock = {
      loadMetadata: jest.fn(),
      getSchema: jest.fn(),
    } as unknown as SchemaGenerator;

    const dumpSchemaProcess = new DumpSchemaProcess(schemaGeneratorMock);

    afterEach(() => {
      jest.restoreAllMocks();
      jest.resetAllMocks();
    });

    describe("#getName", () => {
      it("should return the name of the process", () => {
        expect(dumpSchemaProcess.getName()).toEqual("rest:dump-schema");
      });
    });

    describe("#execute", () => {
      it("should load the metadata and output the schema", async () => {
        (schemaGeneratorMock.loadMetadata as jest.Mock).mockResolvedValueOnce(
          undefined
        );
        (schemaGeneratorMock.getSchema as jest.Mock).mockResolvedValueOnce({
          test: "DUMMY_SCHEMA",
        });

        const writeMock = jest.spyOn(process.stdout, "write");
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
