import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "accounting_periods",
      columns: [
        { name: "name", type: "string" },
        { name: "start_date", type: "number" },
        { name: "end_date", type: "number" },
        { name: "is_closed", type: "boolean" },
        { name: "closed_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "chart_of_accounts",
      columns: [
        { name: "code", type: "string",  isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "type", type: "string" },
        {
          name: "parent_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cash_account", type: "boolean" },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "accounting_settings",
      columns: [
        { name: "inventory_account_id", type: "string", isIndexed: true },
        { name: "sales_account_id", type: "string", isIndexed: true },
        { name: "cogs_account_id", type: "string", isIndexed: true },
        { name: "customers_account_id", type: "string", isIndexed: true },
        { name: "suppliers_account_id", type: "string", isIndexed: true },
        { name: "cash_default_account_id", type: "string", isIndexed: true },
        {
          name: "bank_default_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "service_revenue_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "income_summary_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "retained_earnings_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "payment_allocations",
      columns: [
        {
          name: "payment_voucher_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "receipt_voucher_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "allocatable_type", type: "string", isIndexed: true },
        { name: "allocatable_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "units",
      columns: [
        { name: "name", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "product_units",
      columns: [
        { name: "product_id", type: "string", isIndexed: true },
        { name: "unit_id", type: "string", isIndexed: true },
        { name: "barcode", type: "string", isOptional: true, isIndexed: true },
        { name: "conversion_factor", type: "number" },
        { name: "sale_price", type: "number" },
        { name: "purchase_price", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "suppliers",
      columns: [
        { name: "name", type: "string", isIndexed: true },
        { name: "phone", type: "string", isOptional: true, isIndexed: true },
        { name: "address", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "purchase_invoices",
      columns: [
        {
          name: "invoice_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "invoice_date", type: "number" },
        { name: "payment_type", type: "string" },
        { name: "status", type: "string" },
        { name: "total", type: "number" },
        { name: "paid_amount", type: "number" },
        { name: "created_by", type: "string" },
        {
          name: "supplier_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "purchase_invoice_items",
      columns: [
        { name: "purchase_invoice_id", type: "string", isIndexed: true },
        { name: "product_id", type: "string", isIndexed: true },
        { name: "product_unit_id", type: "string", isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "unit_cost", type: "number" },
        { name: "total", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "customers",
      columns: [
        { name: "name", type: "string", isIndexed: true },
        { name: "phone", type: "string", isIndexed: true },
        { name: "address", type: "string", isOptional: true },
        { name: "notes", type: "string", isOptional: true },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "categories",
      columns: [
        { name: "name", type: "string" },
        { name: "icon", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
      ],
    }),
    // تحديث جدول المنتجات
    tableSchema({
      name: "products",
      columns: [
        {
          name: "category_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "name", type: "string", isIndexed: true },
        { name: "sku", type: "string", isOptional: true, isIndexed: true },
        { name: "last_purchase_cost", type: "number" },
        { name: "min_stock", type: "number" },
        {
          name: "is_active",
          type: "boolean",
        },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    // أضف هذا الجدول داخل مصفوفة tables في appSchema
    tableSchema({
      name: "product_batches",
      columns: [
        { name: "product_id", type: "string", isIndexed: true },
        {
          name: "purchase_item_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        }, // قد يكون null في حالة التعديلات اليدوية
        { name: "quantity_received", type: "number" },
        { name: "quantity_remaining", type: "number" },
        { name: "unit_cost", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    // جدول فواتير المبيعات
    tableSchema({
      name: "sales_invoices",
      columns: [
        {
          name: "customer_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
         
        {
          name: "invoice_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "invoice_type", type: "string", isIndexed: true },
        { name: "invoice_date", type: "number", isIndexed: true },
        { name: "payment_type", type: "string" },
        { name: "status", type: "string", isIndexed: true },
        { name: "total", type: "number" },
        { name: "paid_amount", type: "number" },
        { name: "created_by", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // جدول عناصر فواتير المبيعات
    tableSchema({
      name: "sales_invoice_items",
      columns: [
        { name: "sales_invoice_id", type: "string", isIndexed: true },
        { name: "item_type", type: "string" },
        {
          name: "product_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "product_unit_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "description", type: "string", isOptional: true },
        { name: "quantity", type: "number" },
        { name: "unit_price", type: "number" },
        { name: "cost_at_sale", type: "number" },
        { name: "total", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    tableSchema({
      name: "stock_movements",
      columns: [
        {
          name: "product_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "product_unit_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "batch_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        {
          name: "quantity",
          type: "number",
        },

        {
          name: "movement_type",
          type: "string",
          isIndexed: true,
        },

        {
          name: "reference_type",
          type: "string",
          isOptional: true,
        },

        {
          name: "reference_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        {
          name: "unit_cost",
          type: "number",
        },

        {
          name: "movement_date",
          type: "number",
        },

        {
          name: "created_at",
          type: "number",
        },

        {
          name: "updated_at",
          type: "number",
        },
      ],
    }),

    tableSchema({
      name: "journal_entries",
      columns: [
        { name: "entry_date", type: "number", isIndexed: true },
        {
          name: "reference_type",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "reference_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "description", type: "string", isOptional: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "created_by", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "journal_entry_lines",
      columns: [
        { name: "journal_entry_id", type: "string", isIndexed: true },
        { name: "account_id", type: "string", isIndexed: true },
        { name: "debit", type: "number" },
        { name: "credit", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "receipt_vouchers",
      columns: [
        {
          name: "voucher_number",
          type: "string",
          isIndexed: true,
        },
        {
          name: "voucher_date",
          type: "number",
        },
        {
          name: "payment_account_id",
          type: "string",
          isIndexed: true,
        },
        {
          name: "amount",
          type: "number",
        },
        {
          name: "description",
          type: "string",
          isOptional: true,
        },
        {
          name: "reference_type",
          type: "string",
          isOptional: true,
        },
        {
          name: "reference_id",
          type: "string",
          isOptional: true,
        },
        {
          name: "status",
          type: "string",
        },
        {
          name: "created_by",
          type: "string",
        },
        {
          name: "created_at",
          type: "number",
        },
        {
          name: "updated_at",
          type: "number",
        },
      ],
    }),
    tableSchema({
      name: "payment_vouchers",
      columns: [
        {
          name: "voucher_number",
          type: "string",
          isIndexed: true,
        },
        {
          name: "voucher_date",
          type: "number",
        },
        {
          name: "payment_account_id",
          type: "string",
          isIndexed: true,
        },
        {
          name: "amount",
          type: "number",
        },
        {
          name: "description",
          type: "string",
          isOptional: true,
        },
        {
          name: "reference_type",
          type: "string",
          isOptional: true,
        },
        {
          name: "reference_id",
          type: "string",
          isOptional: true,
        },
        {
          name: "status",
          type: "string",
        },
        {
          name: "created_by",
          type: "string",
        },
        {
          name: "created_at",
          type: "number",
        },
        {
          name: "updated_at",
          type: "number",
        },
      ],
    }),
  ],
});
