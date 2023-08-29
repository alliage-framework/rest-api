import { AbstractProcess } from "@alliage/process-manager";

import { SchemaGenerator } from "../service/schema-generator";

export class DumpSchemaProcess extends AbstractProcess {
  constructor(private schemaGenerator: SchemaGenerator) {
    super();
  }

  getName = () => "rest:dump-schema";

  async execute() {
    await this.schemaGenerator.loadMetadata();
    const schema = await this.schemaGenerator.getSchema();
    process.stdout.write(JSON.stringify(schema, null, 2));

    return true;
  }
}
