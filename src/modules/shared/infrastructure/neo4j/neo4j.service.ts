import { Injectable, OnModuleDestroy } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME ?? 'neo4j',
        process.env.NEO4J_PASSWORD ?? 'password',
      ),
    );
  }

  getSession(): Session {
    return this.driver.session();
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
