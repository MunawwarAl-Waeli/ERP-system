import {
  CreatePurchaseInvoiceInput,
  PurchaseInvoiceData,
} from "@core/types/purchases/purchaseInvoice";
import { DocumentStatus } from "@core/constants";
import { database } from "src/database";
import ProductBatch from "src/database/models/ProductBatch";
import PurchaseInvoice from "src/database/models/PurchaseInvoice";
import PurchaseInvoiceItem from "src/database/models/PurchaseInvoiceItem";
import { Q } from "@nozbe/watermelondb";
import { WatermelonPurchaseInvoiceRepository } from "@infrastructure/watermelon/repositories/WatermelonPurchaseInvoiceRepository";
import {
  PurchaseInvoiceService,
  PurchaseInvoiceServiceImpl,
} from "../services/PurchaseInvoiceService";
import { WatermelonUnitOfWork } from "@infrastructure/watermelon/WatermelonUnitOfWork";
import { WatermelonProductRepository } from "@infrastructure/watermelon/repositories/WatermelonProductRepository";
import { WatermelonInventoryRepository } from "@infrastructure/watermelon/repositories/WatermelonInventoryRepository";
import { WatermelonPaymentVoucherRepository } from "@infrastructure/watermelon/repositories/WatermelonPaymentVoucherRepository";
import { WatermelonJournalEntryRepository } from "@infrastructure/watermelon/repositories/WatermelonJournalEntryRepository";
import { WatermelonAccountingSettingRepository } from "@infrastructure/watermelon/repositories/WatermelonAccountingSettingRepository";
import { WatermelonDocumentNumberGenerator } from "@infrastructure/numbering/WatermelonDocumentNumberGenerator";

export type PurchaseInvoiceStatus = DocumentStatus;

export interface PurchaseItemFormData {
  productId: string;
  productUnitId: string;
  quantity: number;
  unitCost: number;
  discount?: number;
}

export interface PurchaseInvoiceRepository {
  getById(id: string): Promise<PurchaseInvoiceData | null>;
  getByNumber(invoiceNumber: string): Promise<PurchaseInvoiceData | null>;
  getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PurchaseInvoiceData | null>;
  getBySupplier(supplierId: string): Promise<PurchaseInvoiceData[]>;
  getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<PurchaseInvoiceData[]>;
  getDrafts(): Promise<PurchaseInvoiceData[]>;
  getPosted(): Promise<PurchaseInvoiceData[]>;
  createDraft(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoiceData>;
  updateDraft(
    id: string,
    input: CreatePurchaseInvoiceInput,
  ): Promise<PurchaseInvoiceData>;
  markPosted(id: string, invoiceNumber: string): Promise<PurchaseInvoiceData>;
  markCancelled(id: string, cancelledAt: string): Promise<PurchaseInvoiceData>;
  deleteDraft(id: string): Promise<void>;
  increasePaidAmount(id: string, amount: number): Promise<PurchaseInvoiceData>;
  setPaidAmount(id: string, amount: number): Promise<PurchaseInvoiceData>;
  decreasePaidAmount(id: string, amount: number): Promise<PurchaseInvoiceData>;
  getBatchesByPurchaseItemIds(itemIds: string[]): Promise<ProductBatch[]>;
}

export const purchaseDataRepository: PurchaseInvoiceRepository =
  new WatermelonPurchaseInvoiceRepository(database);

const invoiceCollection = database.get<PurchaseInvoice>("purchase_invoices");
const itemsCollection = database.get<PurchaseInvoiceItem>(
  "purchase_invoice_items",
);

function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const trimmed = value?.trim?.();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeItems(
  items: Array<{
    productId: string;
    productUnitId: string;
    quantity: number;
    unitCost: number;
    discount?: number;
  }>,
) {
  return items.map((i) => ({
    productId: i.productId,
    productUnitId: i.productUnitId,
    quantity: i.quantity,
    unitCost: i.unitCost,
    total: i.quantity * i.unitCost,
  }));
}

function getService(): PurchaseInvoiceService {
  return new PurchaseInvoiceServiceImpl({
    unitOfWork: new WatermelonUnitOfWork(database),
    purchaseInvoiceRepository: purchaseDataRepository,
    productRepository: new WatermelonProductRepository(database),
    inventoryRepository: new WatermelonInventoryRepository(database),
    paymentVoucherRepository: new WatermelonPaymentVoucherRepository(database),
    journalEntryRepository: new WatermelonJournalEntryRepository(database),
    accountingSettingRepository: new WatermelonAccountingSettingRepository(
      database,
    ),
    documentNumberGenerator: new WatermelonDocumentNumberGenerator(database),
  });
}

export const purchaseRepository = {
  // ============================================================
  // Observables for UI
  // ============================================================

  observeAll: () =>
    invoiceCollection.query(Q.sortBy("created_at", Q.desc)).observe(),

  observeByStatus: (status: DocumentStatus) =>
    invoiceCollection
      .query(Q.where("status", status), Q.sortBy("created_at", Q.desc))
      .observe(),

  observeById: (id: string) => invoiceCollection.findAndObserve(id),

  observeItems: (invoiceId: string) =>
    itemsCollection
      .query(
        Q.where("purchase_invoice_id", invoiceId),
        Q.sortBy("created_at", Q.asc),
      )
      .observe(),

  // ============================================================
  // UI action: create draft
  // ============================================================

  createDraft: async (input: {
    supplierId?: string;
    invoiceDate: Date | string;
    paymentType: "cash" | "credit" | "partial";
    items: Array<{
      productId: string;
      productUnitId: string;
      quantity: number;
      unitCost: number;
      discount?: number;
    }>;
    notes?: string;
  }) => {
    if (!input.supplierId) {
      throw new Error("المورد مطلوب لإنشاء فاتورة شراء.");
    }
    const service = getService();
    return service.createDraft({
      supplierId: input.supplierId,
      invoiceDate: toDateString(input.invoiceDate),
      paymentType: input.paymentType,
      createdBy: "current-user",
      items: normalizeItems(input.items),
    });
  },

  // ============================================================
  // UI action: update draft
  // ============================================================

  updateDraft: async (
    arg1:
      | string
      | {
          id: string;
          supplierId?: string;
          invoiceDate: Date | string;
          paymentType: "cash" | "credit" | "partial";
          items: Array<{
            productId: string;
            productUnitId: string;
            quantity: number;
            unitCost: number;
            discount?: number;
          }>;
        },
    arg2?: CreatePurchaseInvoiceInput,
  ) => {
    const service = getService();
    if (typeof arg1 === "string" && arg2) {
      return service.updateDraft(arg1, arg2);
    }
    const data = arg1 as {
      id: string;
      supplierId?: string;
      invoiceDate: Date | string;
      paymentType: "cash" | "credit" | "partial";
      items: Array<{
        productId: string;
        productUnitId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
      }>;
    };
    if (!data.supplierId) {
      throw new Error("المورد مطلوب لتعديل فاتورة شراء.");
    }
    return service.updateDraft(data.id, {
      supplierId: data.supplierId,
      invoiceDate: toDateString(data.invoiceDate),
      paymentType: data.paymentType,
      createdBy: "current-user",
      items: normalizeItems(data.items),
    });
  },

  // ============================================================
  // UI action: post draft
  // ============================================================

  approve: async (id: string, paymentAmount?: number) => {
    return getService().post(id, paymentAmount);
  },

  // ============================================================
  // UI action: cancel posted invoice (with full reversal)
  // ============================================================

  cancel: async (id: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return getService().cancel(id, today);
  },

  // ============================================================
  // UI action: create and approve in one flow
  // ============================================================

  create: async (data: {
    supplierId: string;
    invoiceDate: Date | string;
    paymentType: "cash" | "credit" | "partial";
    paidAmount?: number;
    items: Array<{
      productId: string;
      productUnitId: string;
      quantity: number;
      unitCost: number;
      discount?: number;
    }>;
    notes?: string;
  }) => {
    const draft = await purchaseRepository.createDraft(data);
    return getService().post(draft.id, data.paidAmount);
  },

  // ============================================================
  // Direct repository queries
  // ============================================================

  getById: (id: string) => purchaseDataRepository.getById(id),
  getByNumber: (num: string) => purchaseDataRepository.getByNumber(num),
  getBySupplier: (sid: string) => purchaseDataRepository.getBySupplier(sid),
  getDrafts: () => purchaseDataRepository.getDrafts(),
  getPosted: () => purchaseDataRepository.getPosted(),

  getBatchesByPurchaseItemIds: (itemIds: string[]) =>
    purchaseDataRepository.getBatchesByPurchaseItemIds(itemIds),
};
