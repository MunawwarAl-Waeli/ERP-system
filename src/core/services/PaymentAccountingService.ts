import { database } from "src/database";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import PaymentAllocation from "src/database/models/PaymentAllocation";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import { Model, Q } from "@nozbe/watermelondb";
import { JournalService, JournalLineInput } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";
import { ALLOCATABLE_TYPES } from "@core/constants";

export const PaymentAccountingService = {
  getDefaultExpenseAccount: async (): Promise<string> => {
    const accounts = await database
      .get<ChartOfAccount>("chart_of_accounts")
      .query(Q.where("code", "5100"))
      .fetch();

    const accountId = accounts[0]?.id;

    if (!accountId) {
      throw new Error("Default expense account (5100) was not found.");
    }

    return accountId;
  },

  preparePaymentEntry: async (
    voucher: PaymentVoucher,
    allocations: PaymentAllocation[],
  ): Promise<Model[]> => {
    const settings = await AccountingSettingsService.getSettings();

    const lines: JournalLineInput[] = [];

    // ============================================================
    // 1. الطرف الدائن: حساب الدفع
    // ============================================================

    lines.push({
      accountId: (voucher as any).paymentAccountId ?? voucher.id,
      debit: 0,
      credit: voucher.amount,
    });

    // ============================================================
    // 2. الطرف المدين
    // ============================================================

    if (allocations.length > 0) {
      const totalAllocated = allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      );

      // يجب أن يكون كامل مبلغ السند مخصصاً
      if (Math.abs(totalAllocated - voucher.amount) > 0.001) {
        throw new Error(
          `Payment voucher allocation is unbalanced. Voucher amount: ${voucher.amount}, Allocated amount: ${totalAllocated}`,
        );
      }

      for (const allocation of allocations) {
        let debitAccountId: string;

        if ((allocation as any).allocatableType === ALLOCATABLE_TYPES.PURCHASE_INVOICE) {
          debitAccountId = settings.suppliersAccountId;
        } else {
          debitAccountId =
            await PaymentAccountingService.getDefaultExpenseAccount();
        }

        if (!debitAccountId) {
          throw new Error(
            "Debit account for payment allocation was not found.",
          );
        }

        lines.push({
          accountId: debitAccountId,
          debit: allocation.amount,
          credit: 0,
        });
      }
    } else {
      // ==========================================================
      // 3. سند صرف مباشر غير مرتبط بفاتورة
      // ==========================================================

      const defaultExpenseAccountId =
        await PaymentAccountingService.getDefaultExpenseAccount();

      lines.push({
        accountId: defaultExpenseAccountId,
        debit: voucher.amount,
        credit: 0,
      });
    }

    // ============================================================
    // 4. إنشاء القيد من خلال JournalService
    // ============================================================

    return JournalService.prepareCreateEntry({
      entryDate: voucher.voucherDate,
      description: `سند صرف رقم: ${voucher.voucherNumber} - ${
        voucher.description || ""
      }`,
      lines,
      referenceType: "payment_voucher",
      referenceId: voucher.id,
      createdBy: voucher.createdBy,
      idempotencyKey: `payment-voucher:${voucher.id}`,
    });
  },
};
