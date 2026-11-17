// 1. Ø§Ù„Ø£Ù†ÙˆØ§Ø¹ ÙˆØ§Ù„Ù€ DTOs (ÙÙŠ src/core/types/sales/salesInvoice.ts)
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
  discountTotal?: number;
  serviceFee?: number;
  paidAmount?: number;
  customerId?: string;
  // invoiceNumber?: string;
  invoiceDate: string;
  paymentType: PaymentType;
  // paidAmount?: number;
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
// ÙŠÙ†ÙØ° Ø¹Ù…Ù„ÙŠØ© Ø§Ù„ØªØ±Ø­ÙŠÙ„ Ù„Ø§Ù†Ù‡ Ù†Ø­ØªØ§Ø¬ Ù†Ø¹Ø±Ù Ø§Ù„Ù…Ø¨Ù„Øº ÙˆÙ‡Ù„ ÙƒØ§Ø´ Ø§Ùˆ Ø¨Ù†Ùƒ
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
  serviceFee:number;
  discountTotal:number;
  createdBy: string;
  idempotencyKey?: string;
  isCancelled: boolean;
  cancelledAt?: string;
  items: SalesInvoiceItemData[];
  createdAt: number;
  updatedAt: number;
}


