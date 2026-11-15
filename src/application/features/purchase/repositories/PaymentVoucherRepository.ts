import {
  CreatePaymentVoucherInput,
  PaymentVoucherData,
  PostPaymentVoucherInput,
} from "../../../../core/types/purchases/paymentVoucher";

export interface PaymentVoucherRepository {
  getById(id: string): Promise<PaymentVoucherData | null>;

  getByNumber(voucherNumber: string): Promise<PaymentVoucherData | null>;

  getBySupplier(supplierId: string): Promise<PaymentVoucherData[]>;

  getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<PaymentVoucherData[]>;

  getDrafts(): Promise<PaymentVoucherData[]>;

  getPosted(): Promise<PaymentVoucherData[]>;

  createDraft(input: CreatePaymentVoucherInput): Promise<PaymentVoucherData>;

  updateDraft(
    id: string,
    input: CreatePaymentVoucherInput,
  ): Promise<PaymentVoucherData>;

  persistPosted(input: PostPaymentVoucherInput): Promise<PaymentVoucherData>;

  markCancelled(id: string, cancelledAt: string): Promise<PaymentVoucherData>;
}
