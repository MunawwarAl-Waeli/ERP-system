import {
  CreateReceiptVoucherInput,
  ReceiptVoucherData,
  PostReceiptVoucherInput,
} from "../../../../core/types/sales/receiptVoucher";

export interface ReceiptVoucherRepository {
  getById(id: string): Promise<ReceiptVoucherData | null>;

  getByNumber(voucherNumber: string): Promise<ReceiptVoucherData | null>;

  getByCustomer(customerId: string): Promise<ReceiptVoucherData[]>;

  getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ReceiptVoucherData[]>;

  getDrafts(): Promise<ReceiptVoucherData[]>;

  getPosted(): Promise<ReceiptVoucherData[]>;

  createDraft(input: CreateReceiptVoucherInput): Promise<ReceiptVoucherData>;

  updateDraft(
    id: string,
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData>;

  persistPosted(input: PostReceiptVoucherInput): Promise<ReceiptVoucherData>;

  markCancelled(id: string, cancelledAt: string): Promise<ReceiptVoucherData>;
}
