import { UnitRepository } from "@application/features/inventory/repositories/UnitRepository";
import { UnitOfWork } from "@application/transactions/UnitOfWork";

import {
  CreateUnitInput,
  UnitData,
  UpdateUnitInput,
} from "@core/types/inventory/unit";

import {
  InvalidUnitError,
  UnitAlreadyExistsError,
  UnitNotFoundError,
} from "@core/errors/inventory/UnitErrors";

import { UNIT_CODES } from "@core/constants";

export interface UnitService {
  create(input: CreateUnitInput): Promise<UnitData>;
  update(id: string, input: UpdateUnitInput): Promise<UnitData>;
  getById(id: string): Promise<UnitData | null>;
  getByCode(code: string): Promise<UnitData | null>;
  getAll(): Promise<UnitData[]>;
}

export interface UnitServiceDependencies {
  unitOfWork: UnitOfWork;
  unitRepository: UnitRepository;
}

export class DefaultUnitService implements UnitService {
  constructor(private readonly dependencies: UnitServiceDependencies) {}

  async create(input: CreateUnitInput): Promise<UnitData> {
    const normalized = this.normalizeInput(input);

    this.validateInput(normalized);

    return this.dependencies.unitOfWork.execute(async () => {
      const existing = await this.dependencies.unitRepository.getByCode(
        normalized.code,
      );

      if (existing) {
        throw new UnitAlreadyExistsError(
          `Unit code "${normalized.code}" already exists.`,
        );
      }

      return this.dependencies.unitRepository.create(normalized);
    });
  }

  async update(id: string, input: UpdateUnitInput): Promise<UnitData> {
    const normalized = this.normalizeInput(input);

    this.validateInput(normalized);

    return this.dependencies.unitOfWork.execute(async () => {
      const current = await this.dependencies.unitRepository.getById(id);

      if (!current) {
        throw new UnitNotFoundError();
      }

      /*
       * "piece" is the canonical base unit.
       *
       * Its code is part of the accounting/inventory contract
       * and must never be renamed.
       *
       * The display name may still be changed.
       */
      if (
        current.code === UNIT_CODES.PIECE &&
        normalized.code !== UNIT_CODES.PIECE
      ) {
        throw new InvalidUnitError("The piece unit code cannot be changed.");
      }

      const existing = await this.dependencies.unitRepository.getByCode(
        normalized.code,
      );

      if (existing && existing.id !== id) {
        throw new UnitAlreadyExistsError(
          `Unit code "${normalized.code}" already exists.`,
        );
      }

      return this.dependencies.unitRepository.update(id, normalized);
    });
  }

  async getById(id: string): Promise<UnitData | null> {
    return this.dependencies.unitRepository.getById(id);
  }

  async getByCode(code: string): Promise<UnitData | null> {
    const normalizedCode = this.normalizeCode(code);

    if (!normalizedCode) {
      return null;
    }

    return this.dependencies.unitRepository.getByCode(normalizedCode);
  }

  async getAll(): Promise<UnitData[]> {
    return this.dependencies.unitRepository.getAll();
  }

  private normalizeInput(
    input: CreateUnitInput | UpdateUnitInput,
  ): CreateUnitInput {
    return {
      code: this.normalizeCode(input.code),
      name: this.normalizeName(input.name),
    };
  }

  private normalizeCode(code: string): string {
    return code.trim().toLowerCase();
  }

  private normalizeName(name: string): string {
    return name.trim();
  }

  private validateInput(input: CreateUnitInput): void {
    if (!input.code) {
      throw new InvalidUnitError("Unit code is required.");
    }

    if (!input.name) {
      throw new InvalidUnitError("Unit name is required.");
    }
  }
}
