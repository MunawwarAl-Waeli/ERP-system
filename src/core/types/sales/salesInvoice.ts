// 1. الأنواع والـ DTOs (في src/core/types/sales/salesInvoice.ts)
import {
  DocumentStatus,
  PaymentType,
} from "../../constants";

// --- Inputs (Create/Update) ---
export interface SalesInvoiceItemInput {
  productId: string;
  productUnitId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSalesInvoiceInput {
  customerId?: string;
  // invoiceNumber?: string;
  invoiceDate: string;
  paymentType: PaymentType;
  paidAmount?: number;
  createdBy: string;
  idempotencyKey?: string;
  items: SalesInvoiceItemInput[];
}

// --- Consumption Input (For Posting) ---
export interface SaleItemBatchConsumptionInput {
  salesInvoiceItemId: string;
  batchId: string;
  quantity: number;
  unitCost: number;
}
// ينفذ عملية الترحيل لانه نحتاج نعرف المبلغ وهل كاش او بنك
export interface PostSalesInvoiceCommand {
  salesInvoiceId: string;
  paidAmount: number;
  paymentAccountId?: string;
}
export interface PostSalesInvoiceBatchConsumptionInput {
  batchId: string;
  quantity: number;
  unitCost: number;
}

export interface PostSalesInvoiceItemInput {
  id: string;
  baseQuantity: number;
  costAtSale: number;
  batchConsumptions: PostSalesInvoiceBatchConsumptionInput[];
}

export interface PostSalesInvoiceInput {
  id: string;
  invoiceNumber: string;
  items: PostSalesInvoiceItemInput[];
}

// --- Outputs (Data/State) ---
export interface SaleItemBatchConsumptionData {
  id: string;
  batchId: string;
  quantity: number;
  unitCost: number;
}

export interface SalesInvoiceItemData {
  id: string;
  productId: string;
  productUnitId: string;
  quantity: number;
  unitPrice: number;
  costAtSale: number;
  total: number;
  baseQuantity: number;
  batchConsumptions: SaleItemBatchConsumptionData[];
}

export interface SalesInvoiceData {
  id: string;
  customerId?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  paymentType: PaymentType;
  status: DocumentStatus;
  total: number;
  paidAmount: number;
  createdBy: string;
  idempotencyKey?: string;
  isCancelled: boolean;
  cancelledAt?: string;
  items: SalesInvoiceItemData[];
  createdAt: number;
  updatedAt: number;
}

