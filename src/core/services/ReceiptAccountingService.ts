import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import ReceiptAllocation from "src/database/models/ReceiptAllocation";
import { JournalService, JournalLineInput } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";
import { Model } from "@nozbe/watermelondb";
import { database } from "src/database";

/** خدمة تحضير قيد سند القبض فقط؛ الذمم والتخصيصات مسؤولية حالة الاستخدام. */
export const ReceiptAccountingService = {
  createReceiptEntry: async (voucher: ReceiptVoucher): Promise<void> => {
    const operations = await ReceiptAccountingService.prepareReceiptEntry(voucher);
    if (operations.length === 0) return;
    await database.write(async () => {
      await database.batch(...operations);
    });
  },

  prepareReceiptEntry: async (
    voucher: ReceiptVoucher,
    preparedAllocations: ReceiptAllocation[] = [],
  ): Promise<Model[]> => {
    const settings = await AccountingSettingsService.getSettings();
    const allocatedAmount = preparedAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    const lines: JournalLineInput[] = [
      { accountId: voucher.paymentAccount.id, debit: voucher.amount, credit: 0 },
      {
        accountId: settings.customersAccountId,
        debit: 0,
        credit: allocatedAmount || voucher.amount,
      },
    ];
    return JournalService.prepareCreateEntry({
      entryDate: voucher.voucherDate,
      description: `سند قبض رقم: ${voucher.voucherNumber ?? voucher.id}`,
      lines,
      referenceType: "receipt_voucher",
      referenceId: voucher.id,
      createdBy: voucher.createdBy,
      idempotencyKey: `receipt-voucher:${voucher.id}`,
    });
  },
};
