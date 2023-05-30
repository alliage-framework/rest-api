import { AbstractTask } from "@alliage/builder";

import { MetadataManager } from "../service/metadata-manager";

export class GenerateSchemaTask extends AbstractTask {
  private metadataManager: MetadataManager;

  constructor(metadataManager: MetadataManager) {
    super();
    this.metadataManager = metadataManager;
  }

  getName = () => "rest-generate-schema";

  async run() {
    await this.metadataManager.generateMetadata();
  }
}
