
import {
  AccountingPeriodData,
  CreateAccountingPeriodInput,
} from "@core/types/accounting/accountingPeriod";
import { AccountingPeriodRepository } from "@application/features/accounting/repositories/AccountingPeriodRepository";
import { UnitOfWork } from "@application/transactions/UnitOfWork";

export interface AccountingPeriodService {
  getById(id: string): Promise<AccountingPeriodData | null>;

  get(): Promise<AccountingPeriodData | null>;

  getOpenPeriod(): Promise<AccountingPeriodData | null>;

  getByDate(date: string): Promise<AccountingPeriodData | null>;

  create(input: CreateAccountingPeriodInput): Promise<AccountingPeriodData>;

  close(id: string, closedAt: string): Promise<AccountingPeriodData>;
}

export class AccountingPeriodServiceImpl implements AccountingPeriodService {
  constructor(
    private readonly repository: AccountingPeriodRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async getById(id: string): Promise<AccountingPeriodData | null> {
    const normalizedId = this.normalizeId(id);

    return this.repository.getById(normalizedId);
  }

  async get(): Promise<AccountingPeriodData | null> {
    return this.repository.get();
  }

  async getOpenPeriod(): Promise<AccountingPeriodData | null> {
    return this.repository.getOpenPeriod();
  }

  async getByDate(date: string): Promise<AccountingPeriodData | null> {
    const normalizedDate = this.normalizeDate(date);

    return this.repository.getByDate(normalizedDate);
  }

  async create(
    input: CreateAccountingPeriodInput,
  ): Promise<AccountingPeriodData> {
    const normalizedInput = this.normalizeCreateInput(input);

    this.validateDateRange(normalizedInput.startDate, normalizedInput.endDate);

    /*
     * النظام مصمم ليحتوي على فترة محاسبية واحدة فقط.
     *
     * هذا الفحص موجود في الـService كقاعدة عمل،
     * والـRepository لديه أيضًا حماية دفاعية ضد وجود أكثر من سجل.
     */
    const existingPeriod = await this.repository.get();

    if (existingPeriod) {
      throw new Error(
        "لا يمكن إنشاء فترة محاسبية جديدة لأن النظام يحتوي بالفعل على فترة محاسبية.",
      );
    }

    return this.unitOfWork.execute(() =>
      this.repository.create(normalizedInput),
    );
  }

  async close(id: string, closedAt: string): Promise<AccountingPeriodData> {
    const normalizedId = this.normalizeId(id);
    const normalizedClosedAt = this.normalizeDate(closedAt);

    const period = await this.repository.getById(normalizedId);

    if (!period) {
      throw new Error("الفترة المحاسبية غير موجودة.");
    }

    if (period.isClosed) {
      throw new Error("الفترة المحاسبية مغلقة بالفعل.");
    }

    if (normalizedClosedAt < period.startDate) {
      throw new Error(
        "لا يمكن إغلاق الفترة المحاسبية بتاريخ يسبق تاريخ بدايتها.",
      );
    }

    if (normalizedClosedAt > period.endDate) {
      throw new Error(
        "لا يمكن إغلاق الفترة المحاسبية بتاريخ يتجاوز تاريخ نهايتها.",
      );
    }

    return this.unitOfWork.execute(() =>
      this.repository.close(normalizedId, normalizedClosedAt),
    );
  }

  private normalizeCreateInput(
    input: CreateAccountingPeriodInput,
  ): CreateAccountingPeriodInput {
    if (!input || typeof input !== "object") {
      throw new Error("بيانات إنشاء الفترة المحاسبية غير صحيحة.");
    }

    const name = this.normalizeName(input.name);
    const startDate = this.normalizeDate(input.startDate);
    const endDate = this.normalizeDate(input.endDate);

    return {
      name,
      startDate,
      endDate,
    };
  }

  private normalizeName(name: string): string {
    if (typeof name !== "string") {
      throw new Error("اسم الفترة المحاسبية مطلوب.");
    }

    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new Error("اسم الفترة المحاسبية مطلوب.");
    }

    return normalizedName;
  }

  private normalizeId(id: string): string {
    if (typeof id !== "string") {
      throw new Error("معرف الفترة المحاسبية مطلوب.");
    }

    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الفترة المحاسبية مطلوب.");
    }

    return normalizedId;
  }

  private normalizeDate(date: string): string {
    if (typeof date !== "string") {
      throw new Error("التاريخ يجب أن يكون بالصيغة YYYY-MM-DD.");
    }

    const normalizedDate = date.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new Error("التاريخ يجب أن يكون بالصيغة YYYY-MM-DD.");
    }

    const [yearText, monthText, dayText] = normalizedDate.split("-");

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const timestamp = Date.UTC(year, month - 1, day);

    const parsedDate = new Date(timestamp);

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      throw new Error(`التاريخ غير صحيح: ${normalizedDate}.`);
    }

    return normalizedDate;
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (startDate > endDate) {
      throw new Error(
        "تاريخ بداية الفترة المحاسبية لا يمكن أن يكون بعد تاريخ نهايتها.",
      );
    }
  }
}
