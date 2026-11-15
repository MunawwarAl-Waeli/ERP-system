import { DocumentStatus, PaymentType } from "../../constants";

export interface PurchaseInvoiceItemInput {
  productId: string;
  productUnitId: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface CreatePurchaseInvoiceInput {
  invoiceNumber?: string;
  invoiceDate: string;
  paymentType: PaymentType;
  paidAmount?: number; // ✅ إضافة المبلغ المدفوع للمسودة
  supplierId?: string;
  createdBy: string;
  idempotencyKey?: string;
  items: PurchaseInvoiceItemInput[];
}

export interface PurchaseInvoiceItemData {
  id: string;
  productId: string;
  productUnitId: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseInvoiceData {
  id: string;
  invoiceNumber?: string;
  invoiceDate: string;
  paymentType: PaymentType;
  status: DocumentStatus;
  supplierId?: string;
  total: number;
  paidAmount: number;
  createdBy: string;
  idempotencyKey?: string;
  isCancelled: boolean;
  cancelledAt?: string;
  items: PurchaseInvoiceItemData[];
  createdAt: number;
  updatedAt: number;
}

