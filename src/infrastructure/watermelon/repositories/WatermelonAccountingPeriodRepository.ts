import { Database, Q } from "@nozbe/watermelondb";

import AccountingPeriod from "src/database/models/AccountingPeriod";

import {
  AccountingPeriodData,
  CreateAccountingPeriodInput,
} from "@core/types/accounting/accountingPeriod";

import { AccountingPeriodRepository } from "@application/features/accounting/repositories/AccountingPeriodRepository";

export class WatermelonAccountingPeriodRepository
  implements AccountingPeriodRepository
{
  private readonly periods;

  constructor(private readonly database: Database) {
    this.periods =
      this.database.collections.get<AccountingPeriod>("accounting_periods");
  }

  async getById(id: string): Promise<AccountingPeriodData | null> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الفترة المحاسبية مطلوب.");
    }

    try {
      const period = await this.periods.find(normalizedId);

      return this.toData(period);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async getOpenPeriod(): Promise<AccountingPeriodData | null> {
    const periods = await this.periods
      .query(Q.where("is_closed", false), Q.take(2))
      .fetch();

    if (periods.length === 0) {
      return null;
    }

    if (periods.length > 1) {
      throw new Error("سلامة البيانات: يوجد أكثر من فترة محاسبية مفتوحة.");
    }

    return this.toData(periods[0]);
  }

  async getByDate(date: string): Promise<AccountingPeriodData | null> {
    const timestamp = this.toTimestamp(date);

    const periods = await this.periods
      .query(
        Q.where("start_date", Q.lte(timestamp)),
        Q.where("end_date", Q.gte(timestamp)),
        Q.take(2),
      )
      .fetch();

    if (periods.length === 0) {
      return null;
    }

    if (periods.length > 1) {
      throw new Error("سلامة البيانات: التاريخ يقع ضمن أكثر من فترة محاسبية.");
    }

    return this.toData(periods[0]);
  }

  async get(): Promise<AccountingPeriodData | null> {
    const periods = await this.periods.query(Q.take(2)).fetch();

    if (periods.length === 0) {
      return null;
    }

    if (periods.length > 1) {
      throw new Error("سلامة البيانات: يوجد أكثر من فترة محاسبية في النظام.");
    }

    return this.toData(periods[0]);
  }

  async create(
    input: CreateAccountingPeriodInput,
  ): Promise<AccountingPeriodData> {
    const normalizedInput = this.validateCreateInput(input);

    const existingPeriods = await this.periods.query(Q.take(2)).fetch();

    if (existingPeriods.length > 0) {
      throw new Error(
        "لا يمكن إنشاء فترة محاسبية جديدة؛ النظام يسمح بفترة محاسبية واحدة فقط.",
      );
    }

    const period = this.periods.prepareCreate((record: { name: string; startDate: number; endDate: number; isClosed: boolean; closedAt: null; }) => {
      record.name = normalizedInput.name;
      record.startDate = this.toTimestamp(normalizedInput.startDate);
      record.endDate = this.toTimestamp(normalizedInput.endDate);

      record.isClosed = false;
      record.closedAt = null;
    });

    await this.database.batch(period);

    return this.toData(period);
  }

  async close(id: string, closedAt: string): Promise<AccountingPeriodData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الفترة المحاسبية مطلوب.");
    }

    const normalizedClosedAt = this.normalizeDate(closedAt);

    const period = await this.periods.find(normalizedId);

    if (period.isClosed) {
      throw new Error("الفترة المحاسبية مغلقة بالفعل.");
    }

    const closeTimestamp = this.toTimestamp(normalizedClosedAt);

    if (closeTimestamp < period.startDate) {
      throw new Error("تاريخ إغلاق الفترة لا يمكن أن يسبق تاريخ بدايتها.");
    }

    if (closeTimestamp > period.endDate) {
      throw new Error("تاريخ إغلاق الفترة لا يمكن أن يتجاوز تاريخ نهايتها.");
    }

    await this.database.batch(
      period.prepareUpdate((record: { isClosed: boolean; closedAt: number; }) => {
        record.isClosed = true;
        record.closedAt = closeTimestamp;
      }),
    );

    return this.toData(period);
  }

  private validateCreateInput(input: CreateAccountingPeriodInput): {
    name: string;
    startDate: string;
    endDate: string;
  } {
    const name = input.name?.trim();

    if (!name) {
      throw new Error("اسم الفترة المحاسبية مطلوب.");
    }

    const startDate = this.normalizeDate(input.startDate);

    const endDate = this.normalizeDate(input.endDate);

    const startTimestamp = this.toTimestamp(startDate);

    const endTimestamp = this.toTimestamp(endDate);

    if (startTimestamp > endTimestamp) {
      throw new Error("تاريخ بداية الفترة لا يمكن أن يكون بعد تاريخ نهايتها.");
    }

    return {
      name,
      startDate,
      endDate,
    };
  }

  private normalizeDate(value: string): string {
    const date = value?.trim();

    if (!date) {
      throw new Error("التاريخ مطلوب.");
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      throw new Error(
        `صيغة التاريخ غير صالحة: ${date}. الصيغة المطلوبة YYYY-MM-DD.`,
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const timestamp = Date.UTC(year, month - 1, day);

    const normalized = new Date(timestamp).toISOString().slice(0, 10);

    if (normalized !== date) {
      throw new Error(`التاريخ غير صالح: ${date}.`);
    }

    return date;
  }

  private toTimestamp(date: string): number {
    const normalized = this.normalizeDate(date);

    const [year, month, day] = normalized.split("-").map(Number);

    return Date.UTC(year, month - 1, day);
  }

  private fromTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  private toData(period: AccountingPeriod): AccountingPeriodData {
    return {
      id: period.id,
      name: period.name,
      startDate: this.fromTimestamp(period.startDate),
      endDate: this.fromTimestamp(period.endDate),
      isClosed: period.isClosed,

      closedAt:
        period.closedAt === null || period.closedAt === undefined
          ? undefined
          : this.fromTimestamp(period.closedAt),

      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    );
  }
}
