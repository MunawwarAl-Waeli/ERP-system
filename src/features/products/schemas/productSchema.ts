import z from "zod";

// وحدة المنتج
export const productUnitSchema = z.object({
  unitId: z.string().min(1, { message: "الوحدة مطلوبة" }),
  barcode: z.string().optional(),
  conversionFactor: z
    .number()
    .positive({ message: "عامل التحويل يجب أن يكون أكبر من 0" }),
  salePrice: z.number().min(0, { message: "سعر البيع لا يمكن أن يكون سالباً" }),
  purchasePrice: z
    .number()
    .min(0, { message: "سعر الشراء لا يمكن أن يكون سالباً" }),
});

export type ProductUnitForm = z.infer<typeof productUnitSchema>;

// المنتج الأساسي
export const productSchema = z.object({
  name: z.string().min(1, { message: "اسم المنتج مطلوب" }),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  minStock: z
    .number()
    .min(0, { message: "الحد الأدنى للمخزون يجب أن يكون 0 أو أكثر" }),
  isActive: z.boolean().default(true),
  units: z
    .array(productUnitSchema)
    .min(1, { message: "يجب إضافة وحدة واحدة على الأقل" }),
});

export type ProductForm = z.infer<typeof productSchema>;

export type ProductFormData = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  icon: z.string().default("tag"),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const stockAdjustmentSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional().or(z.literal("")),
});

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;
