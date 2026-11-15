import { Database, Q } from "@nozbe/watermelondb";

import ChartOfAccount from "src/database/models/ChartOfAccount";

import {
  ChartOfAccountData,
  CreateChartOfAccountInput,
  UpdateChartOfAccountInput,
} from "@core/types/accounting/chartOfAccount";
import { ACCOUNT_TYPES } from "@core/constants";
import { ChartOfAccountRepository } from "@application/features/accounting/repositories/ChartOfAccountRepository";

export class WatermelonChartOfAccountRepository
  implements ChartOfAccountRepository
{
  private readonly accounts;

  constructor(private readonly database: Database) {
    this.accounts =
      this.database.collections.get<ChartOfAccount>("chart_of_accounts");
  }

  async getById(id: string): Promise<ChartOfAccountData | null> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    try {
      const account = await this.accounts.find(normalizedId);

      return this.toData(account);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async getByCode(code: string): Promise<ChartOfAccountData | null> {
    const normalizedCode = this.normalizeCode(code);

    const accounts = await this.accounts
      .query(Q.where("code", normalizedCode), Q.take(2))
      .fetch();

    if (accounts.length === 0) {
      return null;
    }

    if (accounts.length > 1) {
      throw new Error(
        `سلامة البيانات: يوجد أكثر من حساب بالكود ${normalizedCode}.`,
      );
    }

    return this.toData(accounts[0]);
  }

  async getAll(): Promise<ChartOfAccountData[]> {
    const accounts = await this.accounts.query(Q.sortBy("code", Q.asc)).fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async getActive(): Promise<ChartOfAccountData[]> {
    const accounts = await this.accounts
      .query(Q.where("is_active", true), Q.sortBy("code", Q.asc))
      .fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async getPostingAccounts(): Promise<ChartOfAccountData[]> {
    const accounts = await this.accounts
      .query(
        Q.where("is_active", true),
        Q.where("allow_posting", true),
        Q.sortBy("code", Q.asc),
      )
      .fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async getCashAccounts(): Promise<ChartOfAccountData[]> {
    const accounts = await this.accounts
      .query(
        Q.where("is_active", true),
        Q.where("is_cash_account", true),
        Q.sortBy("code", Q.asc),
      )
      .fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async getChildren(parentId: string): Promise<ChartOfAccountData[]> {
    const normalizedParentId = parentId.trim();

    if (!normalizedParentId) {
      throw new Error("معرف الحساب الأب مطلوب.");
    }

    const accounts = await this.accounts
      .query(Q.where("parent_id", normalizedParentId), Q.sortBy("code", Q.asc))
      .fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async getRootAccounts(): Promise<ChartOfAccountData[]> {
    const accounts = await this.accounts
      .query(Q.where("parent_id", null), Q.sortBy("code", Q.asc))
      .fetch();

    return accounts.map((account: ChartOfAccount) => this.toData(account));
  }

  async create(input: CreateChartOfAccountInput): Promise<ChartOfAccountData> {
    const normalizedInput = this.validateCreateInput(input);

    const existingAccounts = await this.accounts
      .query(Q.where("code", normalizedInput.code), Q.take(1))
      .fetch();

    if (existingAccounts.length > 0) {
      throw new Error(`كود الحساب مستخدم بالفعل: ${normalizedInput.code}.`);
    }

    if (normalizedInput.parentId) {
      const parent = await this.getRequiredAccount(normalizedInput.parentId);

      this.validateCashAccountRelation(
        normalizedInput.isCashAccount,
        normalizedInput.type,
      );

      if (!parent.isActive) {
        throw new Error("لا يمكن إنشاء حساب تحت حساب أب غير نشط.");
      }
    }

    const account = this.accounts.prepareCreate((record: { code: string; name: string; type: string; parentId: string | null; allowPosting: boolean; isCashAccount: boolean; isActive: boolean; }) => {
      record.code = normalizedInput.code;

      record.name = normalizedInput.name;

      record.type = normalizedInput.type;

      record.parentId = normalizedInput.parentId ?? null;

      record.allowPosting = normalizedInput.allowPosting;

      record.isCashAccount = normalizedInput.isCashAccount;

      record.isActive = true;
    });

    await this.database.batch(account);

    return this.toData(account);
  }

  async update(
    id: string,
    input: UpdateChartOfAccountInput,
  ): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.accounts.find(normalizedId);

    if (input.name !== undefined && !input.name.trim()) {
      throw new Error("اسم الحساب لا يمكن أن يكون فارغًا.");
    }

    const hasChildren = await this.hasChildren(account.id);

    if (input.allowPosting === true && hasChildren) {
      throw new Error(
        "لا يمكن جعل الحساب قابلاً للترحيل لأنه يحتوي على حسابات فرعية.",
      );
    }

    if (input.isCashAccount === true && account.type !== ACCOUNT_TYPES.ASSET) {
      throw new Error("الحساب النقدي يجب أن يكون من نوع الأصول.");
    }

    await this.database.batch(
      account.prepareUpdate((record: { name: string; allowPosting: boolean; isCashAccount: boolean; isActive: boolean; }) => {
        if (input.name !== undefined) {
          record.name = input.name.trim();
        }

        if (input.allowPosting !== undefined) {
          record.allowPosting = input.allowPosting;
        }

        if (input.isCashAccount !== undefined) {
          record.isCashAccount = input.isCashAccount;
        }

        if (input.isActive !== undefined) {
          record.isActive = input.isActive;
        }
      }),
    );

    return this.toData(account);
  }

  async deactivate(id: string): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.accounts.find(normalizedId);

    if (!account.isActive) {
      return this.toData(account);
    }

    await this.database.batch(
      account.prepareUpdate((record: { isActive: boolean; }) => {
        record.isActive = false;
      }),
    );

    return this.toData(account);
  }

  async activate(id: string): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.accounts.find(normalizedId);

    if (account.isActive) {
      return this.toData(account);
    }

    await this.database.batch(
      account.prepareUpdate((record: { isActive: boolean; }) => {
        record.isActive = true;
      }),
    );

    return this.toData(account);
  }

  private validateCreateInput(
    input: CreateChartOfAccountInput,
  ): CreateChartOfAccountInput {
    const code = this.normalizeCode(input.code);

    const name = input.name?.trim();

    if (!name) {
      throw new Error("اسم الحساب مطلوب.");
    }

    if (!code) {
      throw new Error("كود الحساب مطلوب.");
    }

    if (input.allowPosting !== true && input.allowPosting !== false) {
      throw new Error("قيمة allowPosting غير صالحة.");
    }

    if (input.isCashAccount !== true && input.isCashAccount !== false) {
      throw new Error("قيمة isCashAccount غير صالحة.");
    }

    this.validateCashAccountRelation(input.isCashAccount, input.type);

    const parentId = input.parentId?.trim() || undefined;

    return {
      code,
      name,
      type: input.type,
      parentId,
      allowPosting: input.allowPosting,
      isCashAccount: input.isCashAccount,
    };
  }

  private validateCashAccountRelation(
    isCashAccount: boolean,
    type: ChartOfAccountData["type"],
  ): void {
    if (isCashAccount && type !== ACCOUNT_TYPES.ASSET) {
      throw new Error("الحساب النقدي يجب أن يكون من نوع الأصول.");
    }
  }

  private async hasChildren(accountId: string): Promise<boolean> {
    const children = await this.accounts
      .query(Q.where("parent_id", accountId), Q.take(1))
      .fetch();

    return children.length > 0;
  }

  private async getRequiredAccount(id: string): Promise<ChartOfAccountData> {
    const account = await this.getById(id);

    if (!account) {
      throw new Error("الحساب الأب غير موجود.");
    }

    return account;
  }

  private normalizeCode(code: string): string {
    return code?.trim() ?? "";
  }

  private toData(account: ChartOfAccount): ChartOfAccountData {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parentId:
        account.parentId === null || account.parentId === undefined
          ? undefined
          : account.parentId,
      allowPosting: account.allowPosting,
      isCashAccount: account.isCashAccount,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.toLowerCase().includes("not found")
    );
  }
}
