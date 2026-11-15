import { Database, Model, Q } from "@nozbe/watermelondb";

import { DOCUMENT_PREFIXES, DocumentPrefix } from "@core/constants";

import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import SalesInvoice from "src/database/models/SalesInvoice";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import SalesReturn from "src/database/models/SalesReturn";
import CustomerRefund from "src/database/models/CustomerRefund";

import { DocumentNumberGenerator } from "@application/numbering/DocumentNumberGenerator";

interface NumberSource<T extends Model> {
  table: string;
  column: string;
  getNumber: (record: T) => string | undefined;
}

export class WatermelonDocumentNumberGenerator
  implements DocumentNumberGenerator
{
  private readonly sources: Record<DocumentPrefix, NumberSource<Model>>;

  constructor(private readonly database: Database) {
    this.sources = {
      [DOCUMENT_PREFIXES.PURCHASE_INVOICE]: {
        table: PurchaseInvoice.table,
        column: "invoice_number",
        getNumber: (record) => (record as PurchaseInvoice).invoiceNumber || undefined,
      },

      [DOCUMENT_PREFIXES.SALES_INVOICE]: {
        table: SalesInvoice.table,
        column: "invoice_number",
        getNumber: (record) => (record as SalesInvoice).invoiceNumber || undefined,
      },

      [DOCUMENT_PREFIXES.PAYMENT_VOUCHER]: {
        table: PaymentVoucher.table,
        column: "voucher_number",
        getNumber: (record) => (record as PaymentVoucher).voucherNumber || undefined,
      },

      [DOCUMENT_PREFIXES.RECEIPT_VOUCHER]: {
        table: ReceiptVoucher.table,
        column: "voucher_number",
        getNumber: (record) => (record as ReceiptVoucher).voucherNumber || undefined,
      },

      [DOCUMENT_PREFIXES.SALES_RETURN]: {
        table: SalesReturn.table,
        column: "return_number",
        getNumber: (record) => (record as SalesReturn).returnNumber || undefined,
      },

      [DOCUMENT_PREFIXES.CUSTOMER_REFUND]: {
        table: CustomerRefund.table,
        column: "refund_number",
        getNumber: (record) => (record as CustomerRefund).refundNumber || undefined,
      },
    };
  }

  async generate(prefix: DocumentPrefix, date: string): Promise<string> {
    const source = this.sources[prefix];

    if (!source) {
      throw new Error(`Unsupported document prefix: ${prefix}`);
    }

    const normalizedDate = this.normalizeDate(date);

    const documentPrefix = `${prefix}-${normalizedDate.replace(/-/g, "")}-`;

    const records = await this.database
      .get(source.table)
      .query(
        Q.where(source.column, Q.like(`${documentPrefix}%`)),
        Q.sortBy(source.column, Q.desc),
        Q.take(1),
      )
      .fetch();

    let nextSequence = 1;

    if (records.length > 0) {
      const lastNumber = source.getNumber(records[0]);

      if (lastNumber) {
        nextSequence = this.extractSequence(lastNumber) + 1;
      }
    }

    return `${documentPrefix}${this.padSequence(nextSequence)}`;
  }

  private normalizeDate(date: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      throw new Error(
        `Invalid document date. Expected YYYY-MM-DD, received: ${date}`,
      );
    }

    return date;
  }

  private extractSequence(value: string): number {
    const match = /-(\d+)$/.exec(value);

    if (!match) {
      throw new Error(`Invalid document number format: ${value}`);
    }

    const sequence = Number(match[1]);

    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new Error(`Invalid document sequence: ${value}`);
    }

    return sequence;
  }

  private padSequence(sequence: number): string {
    return sequence.toString().padStart(6, "0");
  }
}
