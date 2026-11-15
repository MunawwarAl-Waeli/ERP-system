// schemas/purchaseInvoiceSchema.ts
import { z } from "zod";

export const purchaseInvoiceItemSchema = z.object({
  productId: z.string().min(1, { message: "المنتج مطلوب" }),
  productUnitId: z.string().min(1, { message: "الوحدة مطلوبة" }),
  quantity: z.number().positive({ message: "الكمية يجب أن تكون أكبر من 0" }),
  unitCost: z.number().min(0, { message: "سعر الوحدة لا يمكن أن يكون سالباً" }),
  total: z.number().min(0),
});

export const purchaseInvoiceSchema = z.object({
  supplierId: z.string().optional(),
  invoiceDate: z.date(),
  paymentType: z.enum(["cash", "credit", "partial"]),
  createdBy: z.string().min(1), // ✅ جديد - إلزامي
  items: z
    .array(purchaseInvoiceItemSchema)
    .min(1, { message: "يجب إضافة منتج واحد على الأقل" }),
});

export type PurchaseInvoiceFormData = z.infer<typeof purchaseInvoiceSchema>;
