import {
  CreateSupplierInput,
  SupplierData,
  UpdateSupplierInput,
} from "@core/types/suppliers/suppliers";

import { SupplierRepository } from "@application/features/suppliers/repositories/supplierRepository";

import { UnitOfWork } from "@application/transactions/UnitOfWork";

export interface SupplierService {
  getById(id: string): Promise<SupplierData | null>;

  getAll(): Promise<SupplierData[]>;

  getActive(): Promise<SupplierData[]>;

  getByPhone(phone: string): Promise<SupplierData[]>;

  create(input: CreateSupplierInput): Promise<SupplierData>;

  update(id: string, input: UpdateSupplierInput): Promise<SupplierData>;

  deactivate(id: string): Promise<SupplierData>;

  activate(id: string): Promise<SupplierData>;
}

export class SupplierServiceImpl implements SupplierService {
  constructor(
    private readonly repository: SupplierRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async getById(id: string): Promise<SupplierData | null> {
    const normalizedId = this.normalizeId(id);

    return this.repository.getById(normalizedId);
  }

  async getAll(): Promise<SupplierData[]> {
    return this.repository.getAll();
  }

  async getActive(): Promise<SupplierData[]> {
    return this.repository.getActive();
  }

  async getByPhone(phone: string): Promise<SupplierData[]> {
    const normalizedPhone = this.normalizePhone(phone);

    if (!normalizedPhone) {
      return [];
    }

    return this.repository.getByPhone(normalizedPhone);
  }

  async create(input: CreateSupplierInput): Promise<SupplierData> {
    const normalizedInput = this.normalizeCreateInput(input);

    /*
     * لا نمنع تكرار الاسم أو الهاتف.
     *
     * الهاتف ليس Unique،
     * والاسم ليس Unique،
     * لذلك لا يوجد فحص تكرار يمنع الإنشاء هنا.
     *
     * إذا احتاجت الواجهة لاحقًا إلى تحذير المستخدم
     * من وجود رقم هاتف مسجل مسبقًا، يمكنها استخدام
     * getByPhone() بشكل مستقل.
     */

    return this.unitOfWork.execute(() =>
      this.repository.create(normalizedInput),
    );
  }

  async update(id: string, input: UpdateSupplierInput): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    if (!input || typeof input !== "object") {
      throw new Error("بيانات تحديث المورد غير صحيحة.");
    }

    const hasName = input.name !== undefined;
    const hasPhone = input.phone !== undefined;
    const hasAddress = input.address !== undefined;

    if (!hasName && !hasPhone && !hasAddress) {
      throw new Error("لا توجد بيانات لتحديث المورد.");
    }

    const supplier = await this.repository.getById(normalizedId);

    if (!supplier) {
      throw new Error("المورد غير موجود.");
    }

    const normalizedInput = this.normalizeUpdateInput(input);

    return this.unitOfWork.execute(() =>
      this.repository.update(normalizedId, normalizedInput),
    );
  }

  async deactivate(id: string): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    const supplier = await this.repository.getById(normalizedId);

    if (!supplier) {
      throw new Error("المورد غير موجود.");
    }

    /*
     * التعطيل لا يعني حذف المورد أو إلغاء تاريخه المالي.
     *
     * يجوز تعطيل المورد حتى لو كان لديه:
     * - فواتير شراء سابقة.
     * - دفعات سابقة.
     * - رصيد مستحق.
     *
     * معنى التعطيل فقط:
     * لا يستخدم المورد في العمليات الجديدة.
     */

    if (!supplier.isActive) {
      return supplier;
    }

    return this.unitOfWork.execute(() =>
      this.repository.deactivate(normalizedId),
    );
  }

  async activate(id: string): Promise<SupplierData> {
    const normalizedId = this.normalizeId(id);

    const supplier = await this.repository.getById(normalizedId);

    if (!supplier) {
      throw new Error("المورد غير موجود.");
    }

    if (supplier.isActive) {
      return supplier;
    }

    return this.unitOfWork.execute(() =>
      this.repository.activate(normalizedId),
    );
  }

  private normalizeCreateInput(
    input: CreateSupplierInput,
  ): CreateSupplierInput {
    if (!input || typeof input !== "object") {
      throw new Error("بيانات إنشاء المورد غير صحيحة.");
    }

    return {
      name: this.normalizeName(input.name),
      phone: this.normalizePhone(input.phone),
      address: this.normalizeOptionalText(input.address),
    };
  }

  private normalizeUpdateInput(
    input: UpdateSupplierInput,
  ): UpdateSupplierInput {
    const normalizedInput: UpdateSupplierInput = {};

    if (input.name !== undefined) {
      normalizedInput.name = this.normalizeName(input.name);
    }

    if (input.phone !== undefined) {
      normalizedInput.phone = this.normalizePhone(input.phone);
    }

    if (input.address !== undefined) {
      normalizedInput.address = this.normalizeOptionalText(input.address);
    }

    return normalizedInput;
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
    if (phone === undefined) {
      return undefined;
    }

    if (typeof phone !== "string") {
      throw new Error("رقم هاتف المورد غير صحيح.");
    }

    const normalizedPhone = phone.trim();

    return normalizedPhone || undefined;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new Error("قيمة النص غير صحيحة.");
    }

    const normalizedValue = value.trim();

    return normalizedValue || undefined;
  }
}
