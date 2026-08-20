import PurchaseInvoice from "@core/database/models/PurchaseInvoice";
import { JournalService } from "./JournalService";
import { AccountingSettingsService } from "./AccountingSettingsService";
import { Model } from "@nozbe/watermelondb";

export const PurchaseAccountingService = {
  preparePurchaseEntry: async (invoice: PurchaseInvoice): Promise<Model[]> => {
    const settings = await AccountingSettingsService.getSettings();

    const lines = [
      {
        accountId: settings.inventoryAccountId,

        debit: invoice.total,

        credit: 0,
      },
    ];

    switch (invoice.paymentType) {
      case "cash":
        lines.push({
          accountId: settings.cashAccountId,

          debit: 0,

          credit: invoice.total,
        });

        break;

      case "credit":
        lines.push({
          accountId: settings.suppliersAccountId,

          debit: 0,

          credit: invoice.total,
        });

        break;

      case "partial": {
        const paid = invoice.paidAmount;

        const remaining = Math.max(invoice.total - paid, 0);

        if (paid > 0) {
          lines.push({
            accountId: settings.cashAccountId,

            debit: 0,

            credit: paid,
          });
        }

        if (remaining > 0) {
          lines.push({
            accountId: settings.suppliersAccountId,

            debit: 0,

            credit: remaining,
          });
        }

        break;
      }
    }

    return JournalService.prepareCreateEntry({
      date: invoice.invoiceDate,

      description: `فاتورة شراء رقم ${invoice.invoiceNumber ?? invoice.id}`,

      lines,

      referenceType: "purchase_invoice",

      referenceId: invoice.id,

      createdBy: invoice.createdBy,
    });
  },
};
