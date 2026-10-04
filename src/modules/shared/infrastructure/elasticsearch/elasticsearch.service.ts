import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService extends Client implements OnModuleDestroy {
  constructor() {
    super({ node: process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200' });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
