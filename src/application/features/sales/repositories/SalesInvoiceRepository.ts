import {
  CreateSalesInvoiceInput,
  PostSalesInvoiceInput,
  SalesInvoiceData,
} from "@core/types/sales/salesInvoice";

export interface SalesInvoiceRepository {
  getById(id: string): Promise<SalesInvoiceData | null>;

  getByNumber(invoiceNumber: string): Promise<SalesInvoiceData | null>;

  getByCustomer(customerId: string): Promise<SalesInvoiceData[]>;

  getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<SalesInvoiceData[]>;
  getDrafts(): Promise<SalesInvoiceData[]>;
  getPosted(): Promise<SalesInvoiceData[]>;
  createDraft(input: CreateSalesInvoiceInput): Promise<SalesInvoiceData>;
  updateDraft(
    id: string,
    input: CreateSalesInvoiceInput,
  ): Promise<SalesInvoiceData>;
  persistPosted(input: PostSalesInvoiceInput): Promise<SalesInvoiceData>;
  markCancelled(id: string, cancelledAt: string): Promise<SalesInvoiceData>;
  increasePaidAmount(id: string, amount: number): Promise<SalesInvoiceData>;
  setPaidAmount(id: string, amount: number): Promise<SalesInvoiceData>;
  decreasePaidAmount(id: string, amount: number): Promise<SalesInvoiceData>;
  getByIdempotencyKey(idempotencyKey: string): Promise<SalesInvoiceData | null>;
  getPopularProductIds(limit: number): Promise<string[]>;
}


