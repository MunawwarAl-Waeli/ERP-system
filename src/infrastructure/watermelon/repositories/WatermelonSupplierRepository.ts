import { Database, Q } from "@nozbe/watermelondb";

import Supplier from "src/database/models/Supplier";

import {
  CreateSupplierInput,
  SupplierData,
  UpdateSupplierInput,
} from "@core/types/suppliers/suppliers";

import type { SupplierRepository } from "@application/features/suppliers/repositories/supplierRepository";

export class WatermelonSupplierRepository implements SupplierRepository {
  private readonly suppliers;

  constructor(private readonly database: Database) {
    this.suppliers = this.database.collections.get<Supplier>("suppliers");
  }

  async getById(id: string): Promise<SupplierData | null> {
    const normalizedId = this.normalizeId(id);

    try {
      const supplier = await this.suppliers.find(normalizedId);

      return this.toData(supplier);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async getAll(): Promise<SupplierData[]> {
    const suppliers = await this.suppliers
      .query(Q.sortBy("name", Q.asc))
      .fetch();

    return suppliers.map((supplier: Supplier) => this.toData(supplier));
  }

  async getActive(): Promise<SupplierData[]> {
    const suppliers = await this.suppliers
      .query(Q.where("is_active", true), Q.sortBy("name", Q.asc))
      .fetch();

    return suppliers.map((supplier: Supplier) => this.toData(supplier));
  }

  async getByPhone(phone: string): Promise<SupplierData[]> {
    const normalizedPhone = this.normalizePhone(phone);

    if (!normalizedPhone) {
      return [];
    }

    const suppliers = await this.suppliers
      .query(Q.where("phone", normalizedPhone), Q.sortBy("name", Q.asc))
      .fetch();

    return suppliers.map((supplier: Supplier) => this.toData(supplier));
  }

  async create(input: CreateSupplierInput): Promise<SupplierData> {
    const name = this.normalizeName(input.name);
    const phone = this.normalizeOptionalText(input.phone);
    const address = this.normalizeOptionalText(input.address);

    const supplier = this.suppliers.prepareCreate((record: { name: string; phone: string | null; address: string | null; isActive: boolean; }) => {
      record.name = name;
      record.phone = phone;
      record.address = address;
      record.isActive = true;
    });

    await this.database.batch(supplier);

    return this.toData(supplier);
  }

  async update(id: string, input: UpdateSupplierInput): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    const supplier = await this.getRequiredSupplier(normalizedId);

    const hasName = input.name !== undefined;
    const hasPhone = input.phone !== undefined;
    const hasAddress = input.address !== undefined;

    if (!hasName && !hasPhone && !hasAddress) {
      return this.toData(supplier);
    }

    const name = hasName ? this.normalizeName(input.name!) : supplier.name;

    const phone = hasPhone
      ? this.normalizeOptionalText(input.phone)
      : supplier.phone;

    const address = hasAddress
      ? this.normalizeOptionalText(input.address)
      : supplier.address;

    await this.database.batch(
      supplier.prepareUpdate((record) => {
        record.name = name;
        record.phone = phone;
        record.address = address;
      }),
    );

    return this.toData(supplier);
  }

  async deactivate(id: string): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    const supplier = await this.getRequiredSupplier(normalizedId);

    if (!supplier.isActive) {
      return this.toData(supplier);
    }

    await this.database.batch(
      supplier.prepareUpdate((record) => {
        record.isActive = false;
      }),
    );

    return this.toData(supplier);
  }

  async activate(id: string): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    const supplier = await this.getRequiredSupplier(normalizedId);

    if (supplier.isActive) {
      return this.toData(supplier);
    }

    await this.database.batch(
      supplier.prepareUpdate((record) => {
        record.isActive = true;
      }),
    );

    return this.toData(supplier);
  }

  private async getRequiredSupplier(id: string): Promise<Supplier> {
    try {
      return await this.suppliers.find(id);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw new Error("المورد غير موجود.");
      }

      throw error;
    }
  }

  private toData(supplier: Supplier): SupplierData {
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone ?? undefined,
      address: supplier.address ?? undefined,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }

  private normalizeId(id: string): string {
    if (typeof id !== "string") {
      throw new Error("معرف المورد مطلوب.");
    }

    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف المورد مطلوب.");
    }

    return normalizedId;
  }

  private normalizeName(name: string): string {
    if (typeof name !== "string") {
      throw new Error("اسم المورد مطلوب.");
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error("اسم المورد مطلوب.");
    }

    return normalizedName;
  }

  private normalizePhone(phone: string | undefined): string | undefined {
    if (phone === undefined || phone === null) {
      return undefined;
    }

    if (typeof phone !== "string") {
      throw new Error("رقم هاتف المورد غير صحيح.");
    }

    const normalizedPhone = phone.trim();

    return normalizedPhone || undefined;
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error("قيمة النص غير صحيحة.");
    }

    const normalizedValue = value.trim();

    return normalizedValue || null;
  }

  private isRecordNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.toLowerCase().includes("not found");
  }
}
