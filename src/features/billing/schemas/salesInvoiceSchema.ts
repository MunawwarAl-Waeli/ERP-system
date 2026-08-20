// schemas/salesInvoiceSchema.ts
import { z } from "zod";

// ========================================
// 1. عنصر الفاتورة (Sales Invoice Item)
// ========================================
export const salesInvoiceItemSchema = z.object({
  productId: z.string().min(1, { message: "المنتج مطلوب" }),
  productUnitId: z.string().min(1, { message: "الوحدة مطلوبة" }),
  quantity: z.number().positive({ message: "الكمية يجب أن تكون أكبر من 0" }),
  unitPrice: z
    .number()
    .min(0, { message: "سعر الوحدة لا يمكن أن يكون سالباً" }),
  itemType: z.enum(["product", "service"]),
  discount: z.number().min(0).default(0),
  description: z.string().optional(),
});

export type SalesInvoiceItemFormData = z.infer<typeof salesInvoiceItemSchema>;

// ========================================
// 2. فاتورة المبيعات (Sales Invoice)
// ========================================
export const salesInvoiceSchema = z.object({
  customerId: z.string().optional(),
  invoiceDate: z.date(),
  paidAmount: z.number(),
  paymentType: z.enum(["cash", "credit", "partial"]),
  status: z.enum(["draft", "approved", "cancelled", "paid", "partial"]).optional().default('draft'),
  items: z
    .array(salesInvoiceItemSchema)
    .min(1, { message: "يجب إضافة منتج واحد على الأقل" }),
  discountTotal: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export type SalesInvoiceFormData = z.infer<typeof salesInvoiceSchema>;

// ========================================
// 3. للتحقق من حالة الفاتورة (اختياري)
// ========================================
export const salesInvoiceStatusSchema = z.enum([
  "draft",
  "approved",
  "cancelled",
  "paid",
  "partial",
]);
export type SalesInvoiceStatus = z.infer<typeof salesInvoiceStatusSchema>;

// ========================================
// 4. للتحقق من نوع الدفع (اختياري)
// ========================================
export const paymentTypeSchema = z.enum(["cash", "credit", "partial"]);
export type PaymentType = z.infer<typeof paymentTypeSchema>;
