import { Database, Q } from "@nozbe/watermelondb";

import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import ReceiptAllocation from "src/database/models/ReceiptAllocation";

import {
  CreateReceiptVoucherInput,
  PostReceiptVoucherInput,
  ReceiptAllocationData,
  ReceiptVoucherData,
} from "@core/types/sales/receiptVoucher";

import { DOCUMENT_STATUSES } from "@core/constants";

import { ReceiptVoucherRepository } from "@application/features/sales/repositories/ReceiptVoucherRepository";

export class WatermelonReceiptVoucherRepository
  implements ReceiptVoucherRepository
{
  private readonly vouchers;
  private readonly allocations;

  constructor(private readonly database: Database) {
    this.vouchers = this.database.get<ReceiptVoucher>(ReceiptVoucher.table);

    this.allocations = this.database.get<ReceiptAllocation>(
      ReceiptAllocation.table,
    );
  }

  // =========================================================
  // Queries
  // =========================================================

  async getById(id: string): Promise<ReceiptVoucherData | null> {
    const voucher = await this.findVoucher(id);

    if (!voucher) {
      return null;
    }

    return this.toData(voucher);
  }

  async getByNumber(voucherNumber: string): Promise<ReceiptVoucherData | null> {
    const records = await this.vouchers
      .query(Q.where("voucher_number", voucherNumber), Q.take(1))
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  async getByCustomer(customerId: string): Promise<ReceiptVoucherData[]> {
    const records = await this.vouchers
      .query(
        Q.where("customer_id", customerId),
        Q.sortBy("voucher_date", Q.desc),
      )
      .fetch();

    return Promise.all(records.map((record: ReceiptVoucher) => this.toData(record)));
  }

  async getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ReceiptVoucherData[]> {
    const startTimestamp = this.toTimestamp(startDate);
    const endTimestamp = this.toTimestamp(endDate);

    const records = await this.vouchers
      .query(
        Q.where("voucher_date", Q.gte(startTimestamp)),
        Q.where("voucher_date", Q.lte(endTimestamp)),
        Q.sortBy("voucher_date", Q.asc),
      )
      .fetch();

    return Promise.all(records.map((record: ReceiptVoucher) => this.toData(record)));
  }

  async getDrafts(): Promise<ReceiptVoucherData[]> {
    const records = await this.vouchers
      .query(
        Q.where("status", DOCUMENT_STATUSES.DRAFT),
        Q.sortBy("created_at", Q.desc),
      )
      .fetch();

    return Promise.all(records.map((record: ReceiptVoucher) => this.toData(record)));
  }

  async getPosted(): Promise<ReceiptVoucherData[]> {
    const records = await this.vouchers
      .query(
        Q.where("status", DOCUMENT_STATUSES.POSTED),
        Q.sortBy("voucher_date", Q.desc),
      )
      .fetch();

    return Promise.all(records.map((record: ReceiptVoucher) => this.toData(record)));
  }

  // =========================================================
  // Draft creation
  // =========================================================

  async createDraft(
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData> {
    const voucher = await this.vouchers.create((record: { voucherNumber: null; voucherDate: number; paymentAccount: { id: string; }; customer: { id: string | null; }; amount: number; description: string | null; status: string; createdBy: string; idempotencyKey: string | null; isCancelled: boolean; cancelledAt: null; }) => {
      /*
       * Official voucher number is generated only on posting.
       */
      record.voucherNumber = null;

      record.voucherDate = this.toTimestamp(input.voucherDate);

      record.paymentAccount.id = input.paymentAccountId;

      record.customer.id = input.customerId ?? null;

      record.amount = input.amount;

      record.description = input.description ?? null;

      record.status = DOCUMENT_STATUSES.DRAFT;

      record.createdBy = input.createdBy;

      record.idempotencyKey = input.idempotencyKey ?? null;

      record.isCancelled = false;

      record.cancelledAt = null;
    });

    return this.toData(voucher);
  }

  // =========================================================
  // Draft update
  // =========================================================

  async updateDraft(
    id: string,
    input: CreateReceiptVoucherInput,
  ): Promise<ReceiptVoucherData> {
    const voucher = await this.vouchers.find(id);

    if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new Error("Only draft receipt vouchers can be updated.");
    }

    if (voucher.isCancelled) {
      throw new Error("Cancelled receipt vouchers cannot be updated.");
    }

    await voucher.update((record: { voucherDate: number; paymentAccount: { id: string; }; customer: { id: string | null; }; amount: number; description: string | null; createdBy: string; idempotencyKey: string | null; }) => {
      record.voucherDate = this.toTimestamp(input.voucherDate);

      record.paymentAccount.id = input.paymentAccountId;

      record.customer.id = input.customerId ?? null;

      record.amount = input.amount;

      record.description = input.description ?? null;

      record.createdBy = input.createdBy;

      record.idempotencyKey = input.idempotencyKey ?? null;
    });

    return this.toData(voucher);
  }

  // =========================================================
  // Posting
  // =========================================================

  async persistPosted(
    input: PostReceiptVoucherInput,
  ): Promise<ReceiptVoucherData> {
    const voucher = await this.vouchers.find(input.id);

    if (voucher.isCancelled) {
      throw new Error("Cancelled receipt vouchers cannot be posted.");
    }

    if (voucher.status === DOCUMENT_STATUSES.POSTED) {
      return this.toData(voucher);
    }

    if (voucher.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new Error(
        `Receipt voucher cannot be posted from status: ${voucher.status}`,
      );
    }

    if (!input.voucherNumber.trim()) {
      throw new Error("Posted receipt voucher must have a voucher number.");
    }

    if (input.allocations.length === 0) {
      throw new Error("Posted receipt voucher must contain allocations.");
    }

    await voucher.update((record: { voucherNumber: string; status: string; isCancelled: boolean; cancelledAt: null; }) => {
      record.voucherNumber = input.voucherNumber;

      record.status = DOCUMENT_STATUSES.POSTED;

      record.isCancelled = false;

      record.cancelledAt = null;
    });

    await this.database.batch(
      ...input.allocations.map((allocation) =>
        this.allocations.prepareCreate((record: { receiptVoucher: { set: (arg0: any) => void; }; salesInvoice: { id: string; }; amount: number; }) => {
          record.receiptVoucher.set(voucher);

          record.salesInvoice.id = allocation.salesInvoiceId;

          record.amount = allocation.amount;
        }),
      ),
    );

    return this.toData(voucher);
  }

  // =========================================================
  // Cancellation
  // =========================================================

  async markCancelled(
    id: string,
    cancelledAt: string,
  ): Promise<ReceiptVoucherData> {
    const voucher = await this.vouchers.find(id);

    if (voucher.isCancelled) {
      return this.toData(voucher);
    }

    if (voucher.status !== DOCUMENT_STATUSES.POSTED) {
      throw new Error("Only posted receipt vouchers can be cancelled.");
    }

    await voucher.update((record: { status: string; isCancelled: boolean; cancelledAt: number; }) => {
      record.status = DOCUMENT_STATUSES.CANCELLED;

      record.isCancelled = true;

      record.cancelledAt = this.toTimestamp(cancelledAt);
    });

    return this.toData(voucher);
  }

  // =========================================================
  // Private: Mapping
  // =========================================================

  private async toData(voucher: ReceiptVoucher): Promise<ReceiptVoucherData> {
    const allocations = await voucher.allocations.fetch();

    return {
      id: voucher.id,

      voucherNumber: voucher.voucherNumber ?? undefined,

      voucherDate: this.fromTimestamp(voucher.voucherDate),

      paymentAccountId: voucher.paymentAccount.id,

      customerId: await this.getOptionalCustomerId(voucher),

      amount: voucher.amount,

      description: voucher.description ?? undefined,

      status: voucher.status,

      createdBy: voucher.createdBy,

      idempotencyKey: voucher.idempotencyKey ?? undefined,

      isCancelled: voucher.isCancelled,

      cancelledAt:
        voucher.cancelledAt !== null && voucher.cancelledAt !== undefined
          ? this.fromTimestamp(voucher.cancelledAt)
          : undefined,

      allocations: allocations.map((allocation: ReceiptAllocation) =>
        this.toAllocationData(allocation),
      ),

      createdAt: voucher.createdAt,

      updatedAt: voucher.updatedAt,
    };
  }

  private toAllocationData(
    allocation: ReceiptAllocation,
  ): ReceiptAllocationData {
    return {
      id: allocation.id,

      salesInvoiceId: allocation.salesInvoice.id,

      amount: allocation.amount,
    };
  }

  // =========================================================
  // Private: Relations
  // =========================================================

  private async getOptionalCustomerId(
    voucher: ReceiptVoucher,
  ): Promise<string | undefined> {
    try {
      const customer = await voucher.customer.fetch();
      return customer?.id;
    } catch {
      return undefined;
    }
  }

  // =========================================================
  // Private: Find
  // =========================================================

  private async findVoucher(id: string): Promise<ReceiptVoucher | null> {
    try {
      return await this.vouchers.find(id);
    } catch {
      return null;
    }
  }

  // =========================================================
  // Private: Date conversion
  // =========================================================

  private toTimestamp(date: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date. Expected YYYY-MM-DD: ${date}`);
    }

    const timestamp = Date.parse(`${date}T00:00:00.000Z`);

    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid date: ${date}`);
    }

    return timestamp;
  }

  private fromTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
