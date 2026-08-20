// src/core/services/accounting/ReceiptAccountingService.ts
import ReceiptVoucher from "@core/database/models/ReceiptVoucher";
import PaymentAllocation from "@core/database/models/PaymentAllocation";
import { JournalService, JournalLineInput } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";
import { Model } from "@nozbe/watermelondb";

export const ReceiptAccountingService = {
  /**
   * تحضير قيد سند القبض
   */
  prepareReceiptEntry: async (
    voucher: ReceiptVoucher,
    preparedAllocations: PaymentAllocation[] = [],
  ): Promise<Model[]> => {
    const settings = await AccountingSettingsService.getSettings();
    const lines: JournalLineInput[] = [];

    lines.push({
      accountId: voucher.paymentAccountId,
      debit: voucher.amount,
      credit: 0,
    });

    if (preparedAllocations.length > 0) {
      for (const allocation of preparedAllocations) {
        let creditAccountId = settings.salesAccountId;

        if (
          allocation.allocatableType === "sales_invoices" ||
          allocation.allocatableType === "sales_invoice"
        ) {
          creditAccountId = settings.customersAccountId;
        }

        lines.push({
          accountId: creditAccountId,
          debit: 0,
          credit: allocation.amount,
        });
      }
    } else {
      let creditAccountId = settings.salesAccountId;

      if (
        voucher.referenceType === "customers" ||
        voucher.referenceType === "customer"
      ) {
        creditAccountId = settings.customersAccountId;
      }

      lines.push({
        accountId: creditAccountId,
        debit: 0,
        credit: voucher.amount,
      });
    }

    return JournalService.prepareCreateEntry({
      date: voucher.voucherDate,
      description: `سند قبض رقم: ${voucher.voucherNumber} - ${
        voucher.description || ""
      }`,
      lines,
      referenceType: "receipt_voucher",
      referenceId: voucher.id,
      createdBy: voucher.createdBy,
    });
  },
};
