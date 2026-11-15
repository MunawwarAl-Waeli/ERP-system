import { Database, Q } from "@nozbe/watermelondb";

import Unit from "src/database/models/Unit";

import {
  CreateUnitInput,
  UnitData,
  UpdateUnitInput,
} from "@core/types/inventory/unit";

import { UnitRepository } from "@application/features/inventory/repositories/UnitRepository";

export class WatermelonUnitRepository implements UnitRepository {
  constructor(private readonly database: Database) {}

  async getById(id: string): Promise<UnitData | null> {
    const unit = await this.database
      .get<Unit>("units")
      .find(id)
      .catch(() => null);

    return unit ? this.toData(unit) : null;
  }

  async getByCode(code: string): Promise<UnitData | null> {
    const normalizedCode = code.trim().toLowerCase();

    if (!normalizedCode) {
      return null;
    }

    const units = await this.database
      .get<Unit>("units")
      .query(Q.where("code", normalizedCode), Q.take(1))
      .fetch();

    return units.length > 0 ? this.toData(units[0]) : null;
  }

  async getAll(): Promise<UnitData[]> {
    const units = await this.database
      .get<Unit>("units")
      .query(Q.sortBy("name", Q.asc))
      .fetch();

    return units.map((unit: Unit) => this.toData(unit));
  }

  async create(input: CreateUnitInput): Promise<UnitData> {
    const code = input.code.trim().toLowerCase();

    const name = input.name.trim();

    const unit = await this.database.get<Unit>("units").create((record: { code: string; name: string; }) => {
      record.code = code;
      record.name = name;
    });

    return this.toData(unit);
  }

  async update(id: string, input: UpdateUnitInput): Promise<UnitData> {
    const unit = await this.database.get<Unit>("units").find(id);

    const code = input.code.trim().toLowerCase();

    const name = input.name.trim();

    await unit.update((record: { code: string; name: string; }) => {
      record.code = code;
      record.name = name;
    });

    return this.toData(unit);
  }

  private toData(unit: Unit): UnitData {
    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }
}
