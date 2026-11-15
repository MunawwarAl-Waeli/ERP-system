import { Database } from "@nozbe/watermelondb";

import { UnitOfWork } from "@application/transactions/UnitOfWork";

export class WatermelonUnitOfWork implements UnitOfWork {
  constructor(private readonly database: Database) {}

  async execute<T>(work: () => Promise<T>): Promise<T> {
    return this.database.write(async () => {
      return work();
    });
  }
}
