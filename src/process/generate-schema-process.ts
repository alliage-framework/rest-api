import { AbstractProcess } from "@alliage/process-manager";

import { MetadataManager } from "../service/metadata-manager";

export class GenerateSchemaProcess extends AbstractProcess {
  constructor(private metadataManager: MetadataManager) {
    super();
  }

  getName = () => "rest:generate-schema";

  async execute() {
    await this.metadataManager.generateMetadata();
    return true;
  }
}
