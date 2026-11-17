import { Database, Q } from "@nozbe/watermelondb";

import SalesInvoice from "src/database/models/SalesInvoice";
import SalesInvoiceItem from "src/database/models/SalesInvoiceItem";
import SaleItemBatchConsumption from "src/database/models/SaleItemBatchConsumption";

import {
  CreateSalesInvoiceInput,
  PostSalesInvoiceInput,
  SalesInvoiceData,
  SalesInvoiceItemData,
  SaleItemBatchConsumptionData,
} from "@core/types/sales/salesInvoice";

import { DOCUMENT_STATUSES } from "@core/constants";

import { SalesInvoiceRepository } from "@application/features/sales/repositories/SalesInvoiceRepository";

export class WatermelonSalesInvoiceRepository implements SalesInvoiceRepository {
  private readonly invoices;
  private readonly items;
  private readonly batchConsumptions;

  constructor(private readonly database: Database) {
    this.invoices = this.database.get<SalesInvoice>(SalesInvoice.table);
    this.items = this.database.get<SalesInvoiceItem>(SalesInvoiceItem.table);
    this.batchConsumptions = this.database.get<SaleItemBatchConsumption>(SaleItemBatchConsumption.table);
  }

  async getById(id: string): Promise<SalesInvoiceData | null> {
    const invoice = await this.findInvoice(id);
    if (!invoice) return null;
    return this.toData(invoice);
  }

  async getByNumber(invoiceNumber: string): Promise<SalesInvoiceData | null> {
    const records = await this.invoices
      .query(Q.where("invoice_number", invoiceNumber), Q.take(1))
      .fetch();
    if (records.length === 0) return null;
    return this.toData(records[0]);
  }

  async getByCustomer(customerId: string): Promise<SalesInvoiceData[]> {
    const records = await this.invoices
      .query(Q.where("customer_id", customerId), Q.sortBy("invoice_date", Q.desc))
      .fetch();
    return Promise.all(records.map((record: SalesInvoice) => this.toData(record)));
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<SalesInvoiceData | null> {
    const records = await this.invoices
      .query(Q.where("idempotency_key", idempotencyKey), Q.take(1))
      .fetch();
    if (records.length === 0) return null;
    return this.toData(records[0]);
  }

  async getByDateRange(startDate: string, endDate: string): Promise<SalesInvoiceData[]> {
    const startTimestamp = this.toTimestamp(startDate);
    const endTimestamp = this.toTimestamp(endDate);
    const records = await this.invoices
      .query(
        Q.where("invoice_date", Q.gte(startTimestamp)),
        Q.where("invoice_date", Q.lte(endTimestamp)),
        Q.sortBy("invoice_date", Q.asc)
      )
      .fetch();
    return Promise.all(records.map((record: SalesInvoice) => this.toData(record)));
  }

  async getDrafts(): Promise<SalesInvoiceData[]> {
    const records = await this.invoices
      .query(Q.where("status", DOCUMENT_STATUSES.DRAFT), Q.sortBy("created_at", Q.desc))
      .fetch();
    return Promise.all(records.map((record: SalesInvoice) => this.toData(record)));
  }

  async getPosted(): Promise<SalesInvoiceData[]> {
    const records = await this.invoices
      .query(Q.where("status", DOCUMENT_STATUSES.POSTED), Q.sortBy("invoice_date", Q.desc))
      .fetch();
    return Promise.all(records.map((record: SalesInvoice) => this.toData(record)));
  }

  async createDraft(input: CreateSalesInvoiceInput): Promise<SalesInvoiceData> {
    const invoice = await this.invoices.create(
      (record: any) => {
        record.invoiceNumber = null;
        record.customer.id = input.customerId ?? null;
        record.invoiceDate = this.toTimestamp(input.invoiceDate);
        record.paymentType = input.paymentType;
        record.status = DOCUMENT_STATUSES.DRAFT;
        record.total = Math.round(this.calculateTotal(input.items, input.serviceFee, input.discountTotal));
        record.paidAmount = Math.round(input.paidAmount || 0);
        record.serviceFee = Math.round(input.serviceFee || 0);
        record.discountTotal = Math.round(input.discountTotal || 0);
        record.createdBy = input.createdBy;
        record.idempotencyKey = input.idempotencyKey ?? null;
        record.isCancelled = false;
        record.cancelledAt = null;
      }
    );

    await this.createDraftItems(invoice, input.items);
    return this.toData(invoice);
  }

  async updateDraft(id: string, input: CreateSalesInvoiceInput): Promise<SalesInvoiceData> {
    const invoice = await this.invoices.find(id);

    if (invoice.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new Error("Only draft sales invoices can be updated.");
    }
    if (invoice.isCancelled) {
      throw new Error("Cancelled sales invoices cannot be updated.");
    }

    const existingItems = await invoice.items.fetch();

    const preparedOperations = [
      invoice.prepareUpdate((record: any) => {
        record.customer.id = input.customerId ?? null;
        record.invoiceDate = this.toTimestamp(input.invoiceDate);
        record.paymentType = input.paymentType;
        record.total = Math.round(this.calculateTotal(input.items, input.serviceFee, input.discountTotal));
        record.paidAmount = Math.round(input.paidAmount || 0);
        record.serviceFee = Math.round(input.serviceFee || 0);
        record.discountTotal = Math.round(input.discountTotal || 0);
        record.createdBy = input.createdBy;
        record.idempotencyKey = input.idempotencyKey ?? null;
        record.isCancelled = false;
        record.cancelledAt = null;
      }),
      ...existingItems.map((item: any) => item.prepareDestroyPermanently()),
    ];

    preparedOperations.push(...this.prepareCreateItems(invoice, input.items));
    await this.database.batch(...preparedOperations);
    return this.toData(invoice);
  }

  async persistPosted(input: PostSalesInvoiceInput): Promise<SalesInvoiceData> {
    const invoice = await this.invoices.find(input.id);

    if (invoice.isCancelled) throw new Error("Cancelled sales invoices cannot be posted.");
    if (invoice.status === DOCUMENT_STATUSES.POSTED) return this.toData(invoice);
    if (invoice.status !== DOCUMENT_STATUSES.DRAFT) {
      throw new Error(`Sales invoice cannot be posted from status: ${invoice.status}`);
    }
    if (!input.invoiceNumber.trim()) {
      throw new Error("Posted sales invoice must have an invoice number.");
    }

    const existingItems = await invoice.items.fetch();
    const existingItemsById = new Map(existingItems.map((item: any) => [item.id, item]));

    for (const postedItem of input.items) {
      const item = existingItemsById.get(postedItem.id);
      if (!item) throw new Error(`Sales invoice item not found: ${postedItem.id}`);
      if (!Number.isInteger(postedItem.baseQuantity) || postedItem.baseQuantity <= 0) {
        throw new Error("Posted item base quantity must be a positive integer.");
      }
      if (!Number.isFinite(postedItem.costAtSale) || postedItem.costAtSale < 0) {
        throw new Error("Posted item cost at sale must be a non-negative finite number.");
      }
      if (postedItem.batchConsumptions.length === 0) {
        throw new Error(`Sales invoice item ${postedItem.id} must have batch consumptions.`);
      }
    }

    if (input.items.length !== existingItems.length) {
      throw new Error("Posted items do not match the draft invoice items.");
    }

    const preparedOperations = [
      invoice.prepareUpdate((record: any) => {
        record.invoiceNumber = input.invoiceNumber;
        record.status = DOCUMENT_STATUSES.POSTED;
        record.isCancelled = false;
        record.cancelledAt = null;
      }),
    ];

    const existingConsumptions = await this.getBatchConsumptionsByItems(existingItems);

    for (const item of existingItems) {
      const postedItem = input.items.find((candidate) => candidate.id === item.id);
      if (!postedItem) throw new Error(`Posted item not found for draft item: ${item.id}`);

      preparedOperations.push(
        item.prepareUpdate((record: any) => {
          record.baseQuantity = postedItem.baseQuantity;
          record.costAtSale = postedItem.costAtSale;
        })
      );

      const consumptions = existingConsumptions.get(item.id) ?? [];
      for (const consumption of consumptions) {
        preparedOperations.push(consumption.prepareDestroyPermanently());
      }

      for (const consumption of postedItem.batchConsumptions) {
        if (!Number.isInteger(consumption.quantity) || consumption.quantity <= 0) {
          throw new Error("Batch consumption quantity must be a positive integer.");
        }
        if (!Number.isFinite(consumption.unitCost) || consumption.unitCost < 0) {
          throw new Error("Batch consumption unit cost must be a non-negative finite number.");
        }

        preparedOperations.push(
          this.batchConsumptions.prepareCreate((record: any) => {
            record.salesInvoiceItem.set(item);
            record.productBatch.id = consumption.batchId;
            record.quantity = consumption.quantity;
            record.unitCost = consumption.unitCost;
          })
        );
      }
    }

    await this.database.batch(...preparedOperations);
    return this.toData(invoice);
  }

  async increasePaidAmount(id: string, amount: number): Promise<SalesInvoiceData> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Paid amount increase must be greater than zero.");
    }
    const invoice = await this.invoices.find(id);
    if (invoice.status !== DOCUMENT_STATUSES.POSTED) {
      throw new Error("Only posted sales invoices can receive payments.");
    }
    if (invoice.isCancelled) {
      throw new Error("Cancelled sales invoices cannot receive payments.");
    }
    const newPaidAmount = invoice.paidAmount + amount;
    if (newPaidAmount > invoice.total) {
      throw new Error("Paid amount cannot exceed invoice total.");
    }
    await invoice.update((record: any) => {
      record.paidAmount = newPaidAmount;
    });
    return this.toData(invoice);
  }

  async decreasePaidAmount(id: string, amount: number): Promise<SalesInvoiceData> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Paid amount decrease must be greater than zero.");
    }
    const invoice = await this.invoices.find(id);
    const newPaid = Math.max(invoice.paidAmount - amount, 0);
    await invoice.update((record: any) => {
      record.paidAmount = newPaid;
    });
    return this.toData(invoice);
  }

  async setPaidAmount(id: string, amount: number): Promise<any> {
    // return this.database.write(async () => {
      const row = await this.database.get<SalesInvoice>("sales_invoices").find(id);
      await row.update((r: any) => {
        r.paidAmount = amount;
      });
      return row;
    // });
  }

  async markCancelled(id: string, cancelledAt: string): Promise<SalesInvoiceData> {
    const invoice = await this.invoices.find(id);
    if (invoice.isCancelled) return this.toData(invoice);
    if (invoice.status !== DOCUMENT_STATUSES.POSTED) {
      throw new Error("Only posted sales invoices can be cancelled.");
    }
    await invoice.update((record: any) => {
      record.status = DOCUMENT_STATUSES.CANCELLED;
      record.isCancelled = true;
      record.cancelledAt = this.toTimestamp(cancelledAt);
    });
    return this.toData(invoice);
  }

  async getPopularProductIds(limit: number): Promise<string[]> {
    const itemsCollection = this.database.get<SalesInvoiceItem>("sales_invoice_items");
    const allItems = await itemsCollection.query().fetch();
    const productQuantities = new Map<string, number>();
    for (const item of allItems) {
      const currentQty = productQuantities.get(item.productId) || 0;
      productQuantities.set(item.productId, currentQty + item.quantity);
    }
    return Array.from(productQuantities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  }

  private async createDraftItems(invoice: SalesInvoice, items: CreateSalesInvoiceInput["items"]): Promise<void> {
    if (items.length === 0) {
      throw new Error("Sales invoice must contain at least one item.");
    }
    await this.database.batch(...this.prepareCreateItems(invoice, items));
  }

  private prepareCreateItems(invoice: SalesInvoice, items: CreateSalesInvoiceInput["items"]) {
    return items.map((input) => {
      const total = input.quantity * input.unitPrice;
      return this.items.prepareCreate((record: any) => {
        record.salesInvoice.set(invoice);
        record.product.id = input.productId;
        record.productUnit.id = input.productUnitId;
        record.quantity = input.quantity;
        record.baseQuantity = 0;
        record.unitPrice = input.unitPrice;
        record.costAtSale = 0;
        record.total = total;
      });
    });
  }

  private async toData(invoice: SalesInvoice): Promise<SalesInvoiceData> {
    const items = await invoice.items.fetch();
    const customerId = await this.getOptionalCustomerId(invoice);
    const itemData = await Promise.all(items.map((item: SalesInvoiceItem) => this.toItemData(item)));

    return {
      id: invoice.id,
      customerId,
      invoiceNumber: invoice.invoiceNumber ?? undefined,
      invoiceDate: this.fromTimestamp(invoice.invoiceDate),
      paymentType: invoice.paymentType,
      status: invoice.status,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      serviceFee: invoice.serviceFee || 0,
      discountTotal: invoice.discountTotal || 0,
      createdBy: invoice.createdBy,
      idempotencyKey: invoice.idempotencyKey ?? undefined,
      isCancelled: invoice.isCancelled,
      cancelledAt: invoice.cancelledAt != null ? this.fromTimestamp(invoice.cancelledAt) : undefined,
      items: itemData,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private async toItemData(item: SalesInvoiceItem): Promise<SalesInvoiceItemData> {
    const consumptions = await item.batchConsumptions.fetch();
    return {
      id: item.id,
      productId: item.product.id,
      productUnitId: item.productUnit.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      baseQuantity: item.baseQuantity,
      costAtSale: item.costAtSale,
      total: item.total,
      batchConsumptions: consumptions.map((consumption: SaleItemBatchConsumption) =>
        this.toBatchConsumptionData(consumption)
      ),
    };
  }

  private toBatchConsumptionData(consumption: SaleItemBatchConsumption): SaleItemBatchConsumptionData {
    return {
      id: consumption.id,
      batchId: consumption.productBatch.id,
      quantity: consumption.quantity,
      unitCost: consumption.unitCost,
    };
  }

  private async getOptionalCustomerId(invoice: SalesInvoice): Promise<string | undefined> {
    try {
      const customer = await invoice.customer.fetch();
      return customer?.id;
    } catch {
      return undefined;
    }
  }

  private async getBatchConsumptionsByItems(items: SalesInvoiceItem[]): Promise<Map<string, SaleItemBatchConsumption[]>> {
    const result = new Map<string, SaleItemBatchConsumption[]>();
    for (const item of items) {
      result.set(item.id, await item.batchConsumptions.fetch());
    }
    return result;
  }

  private calculateTotal(
    items: CreateSalesInvoiceInput["items"],
    serviceFee: number = 0,
    discountTotal: number = 0,
  ): number {
    let subtotal = 0;
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("Item quantity must be greater than zero.");
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        throw new Error("Item unit price must be a non-negative finite number.");
      }
      subtotal += item.quantity * item.unitPrice;
    }
    
    const total = Math.max(0, subtotal - discountTotal + serviceFee);
    if (!Number.isSafeInteger(total)) {
      throw new Error("Invoice total exceeds safe integer range.");
    }
    return total;
  }

  private async findInvoice(id: string): Promise<SalesInvoice | null> {
    try {
      return await this.invoices.find(id);
    } catch {
      return null;
    }
  }

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
