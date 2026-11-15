import { Database, Q } from "@nozbe/watermelondb";

import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import PurchaseInvoiceItem from "src/database/models/PurchaseInvoiceItem";

import {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceData,
  PurchaseInvoiceItemData,
} from "@core/types/purchases/purchaseInvoice";
import { PurchaseInvoiceRepository } from "@application/features/purchase/repositories/PurchaseInvoiceRepository";

export class WatermelonPurchaseInvoiceRepository
  implements PurchaseInvoiceRepository
{
  private readonly invoices;
  private readonly items;

  constructor(private readonly database: Database) {
    this.invoices = this.database.get<PurchaseInvoice>(PurchaseInvoice.table);

    this.items = this.database.get<PurchaseInvoiceItem>(
      PurchaseInvoiceItem.table,
    );
  }

  // =========================================================
  // Queries
  // =========================================================

  async getById(id: string): Promise<PurchaseInvoiceData | null> {
    const record = await this.findInvoice(id);

    if (!record) {
      return null;
    }

    return this.toData(record);
  }

  async getByNumber(
    invoiceNumber: string,
  ): Promise<PurchaseInvoiceData | null> {
    const records = await this.invoices
      .query(Q.where("invoice_number", invoiceNumber), Q.take(1))
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  async getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PurchaseInvoiceData | null> {
    const records = await this.invoices
      .query(Q.where("idempotency_key", idempotencyKey), Q.take(1))
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  async getBySupplier(supplierId: string): Promise<PurchaseInvoiceData[]> {
    const records = await this.invoices
      .query(
        Q.where("supplier_id", supplierId),
        Q.sortBy("invoice_date", Q.desc),
      )
      .fetch();

    return Promise.all(
      records.map((record: PurchaseInvoice) => this.toData(record)),
    );
  }

  async getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<PurchaseInvoiceData[]> {
    const startTimestamp = this.toTimestamp(startDate);

    const endTimestamp = this.toTimestamp(endDate);

    const records = await this.invoices
      .query(
        Q.where("invoice_date", Q.gte(startTimestamp)),
        Q.where("invoice_date", Q.lte(endTimestamp)),
        Q.sortBy("invoice_date", Q.asc),
      )
      .fetch();

    return Promise.all(
      records.map((record: PurchaseInvoice) => this.toData(record)),
    );
  }

  async getDrafts(): Promise<PurchaseInvoiceData[]> {
    const records = await this.invoices
      .query(Q.where("status", "draft"), Q.sortBy("created_at", Q.desc))
      .fetch();

    return Promise.all(
      records.map((record: PurchaseInvoice) => this.toData(record)),
    );
  }

  async getPosted(): Promise<PurchaseInvoiceData[]> {
    const records = await this.invoices
      .query(Q.where("status", "posted"), Q.sortBy("invoice_date", Q.desc))
      .fetch();

    return Promise.all(
      records.map((record: PurchaseInvoice) => this.toData(record)),
    );
  }

  // =========================================================
  // Draft creation
  // =========================================================

  async createDraft(
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData> {
    const invoice = await this.invoices.create(
      (record: {
        supplier: { id: string | null };
        invoiceNumber: string | null;
        invoiceDate: number;
        paymentType: string;
        status: string;
        total: number;
        paidAmount: number;
        createdBy: string;
        idempotencyKey: string | null;
        isCancelled: boolean;
        cancelledAt: null;
      }) => {
        record.supplier.id = input.supplierId ?? null;

        record.invoiceNumber = input.invoiceNumber ?? null;

        record.invoiceDate = this.toTimestamp(input.invoiceDate);

        record.paymentType = input.paymentType;

        record.status = "draft";

        record.total = this.calculateTotal(input);

        record.paidAmount = input.paidAmount || 0;

        record.createdBy = input.createdBy;

        record.idempotencyKey = input.idempotencyKey ?? null;

        record.isCancelled = false;

        record.cancelledAt = null;
      },
    );

    await this.createItems(invoice, input);

    return this.toData(invoice);
  }

  async decreasePaidAmount(
    id: string,
    amount: number,
  ): Promise<PurchaseInvoiceData> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }
    const invoice = await this.invoices.find(id);
    const newPaid = Math.max(invoice.paidAmount - amount, 0);
    await invoice.update((record: { paidAmount: number }) => {
      record.paidAmount = newPaid;
    });
    return this.toData(invoice);
  }

  async updateDraft(
    id: string,
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData> {
    const invoice = await this.invoices.find(id);

    if (invoice.status !== "draft") {
      throw new Error("Only draft purchase invoices can be updated.");
    }

    if (invoice.isCancelled) {
      throw new Error("Cancelled purchase invoices cannot be updated.");
    }

    const oldItems = await invoice.items.fetch();

    await this.database.batch(
      ...oldItems.map((item: { prepareDestroyPermanently: () => any }) =>
        item.prepareDestroyPermanently(),
      ),
    );

    await invoice.update(
      (record: {
        supplier: { id: string | null };
        invoiceNumber: string | null;
        invoiceDate: number;
        paymentType: string;
        total: number;
        createdBy: string;
        idempotencyKey: string | null;
      }) => {
        record.supplier.id = input.supplierId ?? null;

        record.invoiceNumber = input.invoiceNumber ?? null;

        record.invoiceDate = this.toTimestamp(input.invoiceDate);

        record.paymentType = input.paymentType;

        record.total = this.calculateTotal(input);

        record.createdBy = input.createdBy;

        record.idempotencyKey = input.idempotencyKey ?? null;
      },
    );

    await this.createItems(invoice, input);

    return this.toData(invoice);
  }

  // =========================================================
  // Posting
  // =========================================================

  async markPosted(
    id: string,
    invoiceNumber: string,
  ): Promise<PurchaseInvoiceData> {
    const invoice = await this.invoices.find(id);

    if (invoice.isCancelled) {
      throw new Error("Cancelled purchase invoices cannot be posted.");
    }

    if (invoice.status === "posted") {
      return this.toData(invoice);
    }

    if (invoice.status !== "draft") {
      throw new Error(
        `Purchase invoice cannot be posted from status: ${invoice.status}`,
      );
    }

    if (!invoiceNumber) {
      throw new Error("Posted purchase invoice must have an invoice number.");
    }

    await invoice.update(
      (record: { invoiceNumber: string; status: string }) => {
        record.invoiceNumber = invoiceNumber;
        record.status = "posted";
      },
    );

    return this.toData(invoice);
  }

  // =========================================================
  // Cancellation
  // =========================================================

  async deleteDraft(id: string): Promise<void> {
    const invoice = await this.invoices.find(id);
    if (invoice.status !== "draft") {
      throw new Error("Cannot delete non-draft invoice.");
    }
    const itemsCollection = this.database.get<any>("purchase_invoice_items");
    const allItems = await itemsCollection.query().fetch();
    const items = allItems.filter((i: any) => i.purchaseInvoiceId === id);
    
    await this.database.batch(
      ...items.map((i: any) => i.prepareDestroyPermanently()),
      invoice.prepareDestroyPermanently()
    );
  }

  async markCancelled(
    id: string,
    cancelledAt: string,
  ): Promise<PurchaseInvoiceData> {
    const invoice = await this.invoices.find(id);

    if (invoice.isCancelled) {
      return this.toData(invoice);
    }

    if (invoice.status !== "posted") {
      throw new Error("Only posted purchase invoices can be cancelled.");
    }

    await invoice.update(
      (record: {
        status: string;
        isCancelled: boolean;
        cancelledAt: number;
      }) => {
        record.status = "cancelled";

        record.isCancelled = true;

        record.cancelledAt = this.toTimestamp(cancelledAt);
      },
    );

    return this.toData(invoice);
  }

  // =========================================================
  // Paid amount cache
  // =========================================================

    async setPaidAmount(
    id: string,
    amount: number,
  ): Promise<PurchaseInvoiceData> {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Paid amount must be a non-negative number.");
    }
    const invoice = await this.invoices.find(id);
    if (amount > invoice.total) {
      throw new Error("Paid amount cannot exceed invoice total.");
    }
    await invoice.update((record: { paidAmount: number }) => {
      record.paidAmount = amount;
    });
    return this.toData(invoice);
  }

  async increasePaidAmount(
    id: string,
    amount: number,
  ): Promise<PurchaseInvoiceData> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const invoice = await this.invoices.find(id);

    if (invoice.status !== "posted") {
      throw new Error(
        "Paid amount can only be updated for posted purchase invoices.",
      );
    }

    if (invoice.isCancelled) {
      throw new Error("Cancelled purchase invoices cannot receive payments.");
    }

    const newPaidAmount = invoice.paidAmount + amount;

    if (newPaidAmount > invoice.total) {
      throw new Error("Paid amount cannot exceed invoice total.");
    }

    await invoice.update((record: { paidAmount: any }) => {
      record.paidAmount = newPaidAmount;
    });

    return this.toData(invoice);
  }

  // =========================================================
  // Private: Items
  // =========================================================

  private async createItems(
    invoice: PurchaseInvoice,
    input: CreatePurchaseInvoiceInput,
  ): Promise<void> {
    if (input.items.length === 0) {
      throw new Error("Purchase invoice must contain at least one item.");
    }

    await this.database.batch(
      ...input.items.map((item) =>
        this.items.prepareCreate(
          (record: {
            purchaseInvoice: { set: (arg0: PurchaseInvoice) => void };
            product: { id: string };
            productUnit: { id: string };
            quantity: number;
            unitCost: number;
            total: number;
          }) => {
            record.purchaseInvoice.set(invoice);

            record.product.id = item.productId;

            record.productUnit.id = item.productUnitId;

            record.quantity = item.quantity;

            record.unitCost = item.unitCost;

            record.total = item.quantity * item.unitCost;
          },
        ),
      ),
    );
  }

  // =========================================================
  // Private: Mapping
  // =========================================================

  private async toData(invoice: PurchaseInvoice): Promise<PurchaseInvoiceData> {
    const items = await invoice.items.fetch();

    return {
      id: invoice.id,

      invoiceNumber: invoice.invoiceNumber ?? undefined,

      invoiceDate: this.fromTimestamp(invoice.invoiceDate),

      paymentType: invoice.paymentType,

      status: invoice.status,

      supplierId: invoice.supplier.id,

      total: invoice.total,

      paidAmount: invoice.paidAmount,

      createdBy: invoice.createdBy,

      idempotencyKey: invoice.idempotencyKey ?? undefined,

      isCancelled: invoice.isCancelled,

      cancelledAt: invoice.cancelledAt
        ? this.fromTimestamp(invoice.cancelledAt)
        : undefined,

      items: items.map((item: PurchaseInvoiceItem) => this.toItemData(item)),

      createdAt: invoice.createdAt,

      updatedAt: invoice.updatedAt,
    };
  }

  private toItemData(item: PurchaseInvoiceItem): PurchaseInvoiceItemData {
    return {
      id: item.id,

      productId: item.product.id,

      productUnitId: item.productUnit.id,

      quantity: item.quantity,

      unitCost: item.unitCost,

      total: item.total,
    };
  }

  // =========================================================
  // Private: Calculations
  // =========================================================

  private calculateTotal(input: CreatePurchaseInvoiceInput): number {
    return input.items.reduce(
      (total, item) => total + item.quantity * item.unitCost,
      0,
    );
  }

  // =========================================================
  // Private: Find
  // =========================================================

  private async findInvoice(id: string): Promise<PurchaseInvoice | null> {
    try {
      return await this.invoices.find(id);
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


