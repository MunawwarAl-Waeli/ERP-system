import { Database, Q } from "@nozbe/watermelondb";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import PaymentAllocation from "src/database/models/PaymentAllocation";
import {
  CreatePaymentVoucherInput,
  PaymentVoucherData,
  PostPaymentVoucherInput,
} from "@core/types/purchases/paymentVoucher";
import { PaymentVoucherRepository } from "@application/features/purchase/repositories/PaymentVoucherRepository";
import { DOCUMENT_STATUSES } from "@core/constants";

export class WatermelonPaymentVoucherRepository
  implements PaymentVoucherRepository
{
  private readonly vouchers;
  private readonly allocations;
  constructor(private readonly database: Database) {
    this.vouchers = database.get<PaymentVoucher>(PaymentVoucher.table);
    this.allocations = database.get<PaymentAllocation>(PaymentAllocation.table);
  }
  async getById(id: string) {
    return this.map(await this.find(id));
  }
  async getByNumber(number: string) {
    return this.map(
      (
        await this.vouchers
          .query(Q.where("voucher_number", number), Q.take(1))
          .fetch()
      )[0],
    );
  }
  async getBySupplier(supplierId: string) {
    return Promise.all(
      (
        await this.vouchers
          .query(
            Q.where("supplier_id", supplierId),
            Q.sortBy("voucher_date", Q.desc),
          )
          .fetch()
      ).map((v: PaymentVoucher) => this.toData(v)),
    );
  }
  async getByDateRange(start: string, end: string) {
    return Promise.all(
      (
        await this.vouchers
          .query(
            Q.where("voucher_date", Q.gte(this.date(start))),
            Q.where("voucher_date", Q.lte(this.date(end))),
          )
          .fetch()
      ).map((v: PaymentVoucher) => this.toData(v)),
    );
  }
  async getDrafts() {
    return Promise.all(
      (
        await this.vouchers
          .query(Q.where("status", DOCUMENT_STATUSES.DRAFT))
          .fetch()
      ).map((v: PaymentVoucher) => this.toData(v)),
    );
  }
  async getPosted() {
    return Promise.all(
      (
        await this.vouchers
          .query(Q.where("status", DOCUMENT_STATUSES.POSTED))
          .fetch()
      ).map((v: PaymentVoucher) => this.toData(v)),
    );
  }
  async createDraft(input: CreatePaymentVoucherInput) {
    const voucher = await this.vouchers.create((v: { voucherNumber: string; voucherDate: number; paymentAccount: { id: string; }; supplier: { id: string; }; amount: number; description: string | null; status: string; createdBy: string; idempotencyKey: string | null; isCancelled: boolean; }) => {
      v.voucherNumber = input.voucherNumber;
      v.voucherDate = this.date(input.voucherDate);
      v.paymentAccount.id = input.paymentAccountId;
      v.supplier.id = input.supplierId;
      v.amount = input.amount;
      v.description = input.description ?? null;
      v.status = DOCUMENT_STATUSES.DRAFT;
      v.createdBy = input.createdBy;
      v.idempotencyKey = input.idempotencyKey ?? null;
      v.isCancelled = false;
    });
    return this.toData(voucher);
  }
  async updateDraft(id: string, input: CreatePaymentVoucherInput) {
    const voucher = await this.vouchers.find(id);
    if (voucher.status !== DOCUMENT_STATUSES.DRAFT || voucher.isCancelled)
      throw new Error("Only active draft payment vouchers can be updated.");
    await voucher.update((v: { voucherDate: number; paymentAccount: { id: string; }; supplier: { id: string; }; amount: number; description: string | null; }) => {
      v.voucherDate = this.date(input.voucherDate);
      v.paymentAccount.id = input.paymentAccountId;
      v.supplier.id = input.supplierId;
      v.amount = input.amount;
      v.description = input.description ?? null;
    });
    return this.toData(voucher);
  }
  async persistPosted(input: PostPaymentVoucherInput) {
    const voucher = await this.vouchers.find(input.id);
    if (voucher.status === DOCUMENT_STATUSES.POSTED)
      return this.toData(voucher);
    if (voucher.status !== DOCUMENT_STATUSES.DRAFT || voucher.isCancelled)
      throw new Error("Only active draft payment vouchers can be posted.");
    if (!input.allocations.length)
      throw new Error("Posted payment voucher must contain allocations.");
    await voucher.update((v: { status: string; isCancelled: boolean; }) => {
      v.status = DOCUMENT_STATUSES.POSTED;
      v.isCancelled = false;
    });
    await this.database.batch(
      ...input.allocations.map((a) =>
        this.allocations.prepareCreate((record: { paymentVoucher: { set: (arg0: any) => void; }; purchaseInvoice: { id: string; }; amount: number; }) => {
          record.paymentVoucher.set(voucher);
          record.purchaseInvoice.id = a.purchaseInvoiceId;
          record.amount = a.amount;
        }),
      ),
    );
    return this.toData(voucher);
  }
  async markCancelled(id: string, cancelledAt: string) {
    const voucher = await this.vouchers.find(id);
    if (voucher.isCancelled) return this.toData(voucher);
    if (voucher.status !== DOCUMENT_STATUSES.POSTED)
      throw new Error("Only posted payment vouchers can be cancelled.");
    await voucher.update((v: { status: string; isCancelled: boolean; cancelledAt: number; }) => {
      v.status = DOCUMENT_STATUSES.CANCELLED;
      v.isCancelled = true;
      v.cancelledAt = this.date(cancelledAt);
    });
    return this.toData(voucher);
  }
  private async find(id: string) {
    try {
      return await this.vouchers.find(id);
    } catch {
      return null;
    }
  }
  private async map(
    voucher?: PaymentVoucher | null,
  ): Promise<PaymentVoucherData | null> {
    return voucher ? this.toData(voucher) : null;
  }
  private async toData(v: PaymentVoucher): Promise<PaymentVoucherData> {
    const rows = await v.allocations.fetch();
    return {
      id: v.id,
      voucherNumber: v.voucherNumber,
      voucherDate: new Date(v.voucherDate).toISOString().slice(0, 10),
      paymentAccountId: v.paymentAccount.id,
      supplierId: v.supplier.id,
      amount: v.amount,
      description: v.description ?? undefined,
      status: v.status,
      createdBy: v.createdBy,
      idempotencyKey: v.idempotencyKey ?? undefined,
      isCancelled: v.isCancelled,
      cancelledAt: v.cancelledAt
        ? new Date(v.cancelledAt).toISOString().slice(0, 10)
        : undefined,
      allocations: rows.map((r: { id: any; purchaseInvoice: { id: any; }; amount: any; }) => ({
        id: r.id,
        purchaseInvoiceId: r.purchaseInvoice.id,
        amount: r.amount,
      })),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }
  private date(value: string) {
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed))
      throw new Error(`Invalid date: ${value}`);
    return parsed;
  }
}
