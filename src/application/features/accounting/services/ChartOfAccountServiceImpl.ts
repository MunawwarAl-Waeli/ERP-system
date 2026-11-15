import { ACCOUNT_TYPES } from "@core/constants";

import {
  ChartOfAccountData,
  CreateChartOfAccountInput,
  UpdateChartOfAccountInput,
} from "@core/types/accounting/chartOfAccount";

import { ChartOfAccountRepository } from "@application/features/accounting/repositories/ChartOfAccountRepository";

import { ChartOfAccountService } from "./ChartOfAccountService";

export class ChartOfAccountServiceImpl implements ChartOfAccountService {
  constructor(
    private readonly chartOfAccountRepository: ChartOfAccountRepository,
  ) {}

  async getById(id: string): Promise<ChartOfAccountData | null> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    return this.chartOfAccountRepository.getById(normalizedId);
  }

  async getByCode(code: string): Promise<ChartOfAccountData | null> {
    const normalizedCode = this.normalizeCode(code);

    if (!normalizedCode) {
      throw new Error("كود الحساب مطلوب.");
    }

    return this.chartOfAccountRepository.getByCode(normalizedCode);
  }

  async getAll(): Promise<ChartOfAccountData[]> {
    return this.chartOfAccountRepository.getAll();
  }

  async getActive(): Promise<ChartOfAccountData[]> {
    return this.chartOfAccountRepository.getActive();
  }

  async getPostingAccounts(): Promise<ChartOfAccountData[]> {
    return this.chartOfAccountRepository.getPostingAccounts();
  }

  async getCashAccounts(): Promise<ChartOfAccountData[]> {
    return this.chartOfAccountRepository.getCashAccounts();
  }

  async getChildren(parentId: string): Promise<ChartOfAccountData[]> {
    const normalizedParentId = parentId.trim();

    if (!normalizedParentId) {
      throw new Error("معرف الحساب الأب مطلوب.");
    }

    return this.chartOfAccountRepository.getChildren(normalizedParentId);
  }

  async getRootAccounts(): Promise<ChartOfAccountData[]> {
    return this.chartOfAccountRepository.getRootAccounts();
  }

  async create(input: CreateChartOfAccountInput): Promise<ChartOfAccountData> {
    const normalizedInput = this.normalizeCreateInput(input);

    this.validateAccountType(normalizedInput.type);

    this.validateCashAccount(normalizedInput);

    if (normalizedInput.parentId) {
      await this.validateParent(normalizedInput.parentId);
    }

    const existingAccount = await this.chartOfAccountRepository.getByCode(
      normalizedInput.code,
    );

    if (existingAccount) {
      throw new Error(`كود الحساب مستخدم بالفعل: ${normalizedInput.code}.`);
    }

    return this.chartOfAccountRepository.create(normalizedInput);
  }

  async update(
    id: string,
    input: UpdateChartOfAccountInput,
  ): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.chartOfAccountRepository.getById(normalizedId);

    if (!account) {
      throw new Error("الحساب المطلوب غير موجود.");
    }

    const normalizedInput = this.normalizeUpdateInput(input);

    this.validateUpdateRules(account, normalizedInput);

    return this.chartOfAccountRepository.update(normalizedId, normalizedInput);
  }

  async deactivate(id: string): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.chartOfAccountRepository.getById(normalizedId);

    if (!account) {
      throw new Error("الحساب المطلوب غير موجود.");
    }

    if (!account.isActive) {
      return account;
    }

    /*
     * لا نسمح حاليًا بتعطيل الحساب الأب
     * إذا كان لديه حسابات فرعية نشطة.
     */
    const children = await this.chartOfAccountRepository.getChildren(
      normalizedId,
    );

    const hasActiveChildren = children.some((child) => child.isActive);

    if (hasActiveChildren) {
      throw new Error("لا يمكن تعطيل حساب يحتوي على حسابات فرعية نشطة.");
    }

    return this.chartOfAccountRepository.deactivate(normalizedId);
  }

  async activate(id: string): Promise<ChartOfAccountData> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("معرف الحساب مطلوب.");
    }

    const account = await this.chartOfAccountRepository.getById(normalizedId);

    if (!account) {
      throw new Error("الحساب المطلوب غير موجود.");
    }

    if (account.isActive) {
      return account;
    }

    if (account.parentId) {
      const parent = await this.chartOfAccountRepository.getById(
        account.parentId,
      );

      if (!parent) {
        throw new Error("لا يمكن تفعيل الحساب؛ الحساب الأب غير موجود.");
      }

      if (!parent.isActive) {
        throw new Error("لا يمكن تفعيل الحساب قبل تفعيل الحساب الأب.");
      }
    }

    return this.chartOfAccountRepository.activate(normalizedId);
  }

  private normalizeCreateInput(
    input: CreateChartOfAccountInput,
  ): CreateChartOfAccountInput {
    const code = this.normalizeCode(input.code);

    const name = input.name?.trim();

    if (!code) {
      throw new Error("كود الحساب مطلوب.");
    }

    if (!name) {
      throw new Error("اسم الحساب مطلوب.");
    }

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

  private normalizeUpdateInput(
    input: UpdateChartOfAccountInput,
  ): UpdateChartOfAccountInput {
    const normalized: UpdateChartOfAccountInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name) {
        throw new Error("اسم الحساب لا يمكن أن يكون فارغًا.");
      }

      normalized.name = name;
    }

    if (input.allowPosting !== undefined) {
      normalized.allowPosting = input.allowPosting;
    }

    if (input.isCashAccount !== undefined) {
      normalized.isCashAccount = input.isCashAccount;
    }

    if (input.isActive !== undefined) {
      normalized.isActive = input.isActive;
    }

    return normalized;
  }

  private validateAccountType(type: CreateChartOfAccountInput["type"]): void {
    const validTypes = Object.values(ACCOUNT_TYPES);

    if (!validTypes.includes(type)) {
      throw new Error(`نوع الحساب غير صالح: ${type}.`);
    }
  }

  private validateCashAccount(input: CreateChartOfAccountInput): void {
    if (input.isCashAccount && input.type !== ACCOUNT_TYPES.ASSET) {
      throw new Error("الحساب النقدي يجب أن يكون من نوع الأصول.");
    }
  }

  private validateParent(parentId: string): Promise<void> {
    return this.validateParentAccount(parentId);
  }

  private async validateParentAccount(parentId: string): Promise<void> {
    const parent = await this.chartOfAccountRepository.getById(parentId);

    if (!parent) {
      throw new Error("الحساب الأب غير موجود.");
    }

    if (!parent.isActive) {
      throw new Error("لا يمكن إنشاء حساب تحت حساب أب غير نشط.");
    }

    /*
     * الحساب الأب يمكن أن يكون حاليًا
     * قابلاً للترحيل، لكن بمجرد إضافة ابن
     * يجب أن يصبح تجميعيًا.
     *
     * هذه المسؤولية يتولاها Repository
     * عند تحديث allowPosting.
     */
    if (parent.allowPosting) {
      throw new Error(
        "لا يمكن إنشاء حساب فرعي تحت حساب قابل للترحيل. اجعل الحساب الأب تجميعيًا أولًا.",
      );
    }
  }

  private validateUpdateRules(
    account: ChartOfAccountData,
    input: UpdateChartOfAccountInput,
  ): void {
    if (input.isCashAccount === true && account.type !== ACCOUNT_TYPES.ASSET) {
      throw new Error("الحساب النقدي يجب أن يكون من نوع الأصول.");
    }

    /*
     * لا نسمح بإلغاء isCashAccount عن طريق
     * update إذا كان الحساب من النوع النقدي
     * إلا بطلب صريح، وهو مسموح حاليًا.
     *
     * تغيير code/type غير ممكن أصلًا لأنهما
     * غير موجودين في UpdateChartOfAccountInput.
     */
  }

  private normalizeCode(code: string): string {
    return code?.trim() ?? "";
  }
}
