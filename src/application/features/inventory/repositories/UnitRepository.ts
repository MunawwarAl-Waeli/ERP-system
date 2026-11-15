import {
  CreateUnitInput,
  UnitData,
  UpdateUnitInput,
} from "@core/types/inventory/unit";

export interface UnitRepository {
  getById(id: string): Promise<UnitData | null>;

  getByCode(code: string): Promise<UnitData | null>;

  getAll(): Promise<UnitData[]>;

  create(input: CreateUnitInput): Promise<UnitData>;

  update(id: string, input: UpdateUnitInput): Promise<UnitData>;
}
