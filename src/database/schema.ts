import { appSchema, tableSchema } from "@nozbe/watermelondb";

/*
  =========================================================
  MASTER ERP SCHEMA - LOCAL-FIRST ACCOUNTING & INVENTORY
  =========================================================
*/

export const schema = appSchema({
  version: 7,

  tables: [
    // =====================================================
    // 1. الفترات المحاسبية
    // =====================================================
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

    // =====================================================
    // 2. دليل الحسابات
    // =====================================================
    tableSchema({
      name: "chart_of_accounts",
      columns: [
        { name: "code", type: "string", isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "type", type: "string" },
        {
          name: "parent_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "allow_posting", type: "boolean" },
        { name: "is_cash_account", type: "boolean" },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 3. إعدادات المحاسبة (تمت إضافة حساب إيراد الخدمات)
    // =====================================================
    tableSchema({
      name: "accounting_settings",
      columns: [
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
        {
          name: "inventory_default_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "sales_default_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "cogs_default_account_id",
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
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 4. الوحدات
    // =====================================================
    tableSchema({
      name: "units",
      columns: [
        { name: "code", type: "string", isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 5. وحدات المنتجات
    // =====================================================
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

    // =====================================================
    // 6. الموردون
    // =====================================================
    tableSchema({
      name: "suppliers",
      columns: [
        { name: "name", type: "string", isIndexed: true },
        { name: "phone", type: "string", isOptional: true, isIndexed: true },
        { name: "address", type: "string", isOptional: true },
        { name: "is_active", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 7. العملاء
    // =====================================================
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

    // =====================================================
    // 8. المصروفات التشغيلية
    // =====================================================
    tableSchema({
      name: "expenses",
      columns: [
        { name: "expense_account_id", type: "string", isIndexed: true },
        { name: "payment_account_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "description", type: "string" },
        { name: "reference_number", type: "string", isOptional: true },
        { name: "expense_date", type: "number", isIndexed: true },
        { name: "created_by", type: "string" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 9. التصنيفات
    // =====================================================
    tableSchema({
      name: "categories",
      columns: [
        { name: "name", type: "string" },
        { name: "icon", type: "string", isOptional: true },
        {
          name: "inventory_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "sales_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        {
          name: "cogs_account_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "created_at", type: "number" },
      ],
    }),

    // =====================================================
    // 10. المنتجات
    // =====================================================
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
        { name: "is_active", type: "boolean" },
        { name: "inventory_account_id", type: "string", isIndexed: true },
        { name: "sales_account_id", type: "string", isIndexed: true },
        { name: "cogs_account_id", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 11. فواتير المشتريات
    // =====================================================
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
        { name: "supplier_id", type: "string", isIndexed: true },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 12. تفاصيل فواتير المشتريات
    // =====================================================
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

    // =====================================================
    // 13. دفعات المخزون FIFO
    // =====================================================
    tableSchema({
      name: "product_batches",
      columns: [
        { name: "product_id", type: "string", isIndexed: true },
        {
          name: "purchase_item_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "quantity_received", type: "number" },
        { name: "quantity_remaining", type: "number" },
        { name: "unit_cost", type: "number" },
        { name: "received_date", type: "number", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 14. فواتير المبيعات (تمت إضافة أجور الخدمة والخصم)
    // =====================================================
    tableSchema({
      name: "sales_invoices",
      columns: [
        { name: "service_fee", type: "number" },
        { name: "discount_total", type: "number" },
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
        { name: "invoice_date", type: "number", isIndexed: true },
        { name: "payment_type", type: "string" },
        { name: "status", type: "string", isIndexed: true },
        { name: "total", type: "number" },
        { name: "paid_amount", type: "number" },
        { name: "created_by", type: "string" },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 15. تفاصيل فواتير المبيعات
    // =====================================================
    tableSchema({
      name: "sales_invoice_items",
      columns: [
        { name: "sales_invoice_id", type: "string", isIndexed: true },
        { name: "product_id", type: "string", isIndexed: true },
        { name: "product_unit_id", type: "string", isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "base_quantity", type: "number" },
        { name: "unit_price", type: "number" },
        { name: "cost_at_sale", type: "number" },
        { name: "total", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 16. حركات المخزون
    // =====================================================
    tableSchema({
      name: "stock_movements",
      columns: [
        { name: "product_id", type: "string", isIndexed: true },
        { name: "product_unit_id", type: "string", isIndexed: true },
        { name: "batch_id", type: "string", isOptional: true, isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "movement_type", type: "string", isIndexed: true },
        { name: "reference_type", type: "string", isOptional: true },
        {
          name: "reference_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "unit_cost", type: "number" },
        { name: "movement_date", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 17. القيود اليومية
    // =====================================================
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
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_reversed", type: "boolean" },
        {
          name: "reversal_of_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "reversed_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 18. تفاصيل القيود اليومية
    // =====================================================
    tableSchema({
      name: "journal_entry_lines",
      columns: [
        { name: "journal_entry_id", type: "string", isIndexed: true },
        { name: "line_order", type: "number", isIndexed: true },
        { name: "account_id", type: "string", isIndexed: true },
        { name: "debit", type: "number" },
        { name: "credit", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 19. تحصيلات العملاء
    // =====================================================
    tableSchema({
      name: "receipt_vouchers",
      columns: [
        {
          name: "voucher_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "voucher_date", type: "number", isIndexed: true },
        { name: "payment_account_id", type: "string", isIndexed: true },
        {
          name: "customer_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "amount", type: "number" },
        { name: "description", type: "string", isOptional: true },
        { name: "status", type: "string" },
        { name: "created_by", type: "string" },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 20. توزيع التحصيل على فواتير العملاء
    // =====================================================
    tableSchema({
      name: "receipt_allocations",
      columns: [
        { name: "receipt_voucher_id", type: "string", isIndexed: true },
        { name: "sales_invoice_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 21. سداد الموردين
    // =====================================================
    tableSchema({
      name: "payment_vouchers",
      columns: [
        { name: "voucher_number", type: "string", isIndexed: true },
        { name: "voucher_date", type: "number", isIndexed: true },
        { name: "payment_account_id", type: "string", isIndexed: true },
        { name: "supplier_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "description", type: "string", isOptional: true },
        { name: "status", type: "string" },
        { name: "created_by", type: "string" },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 22. توزيع سداد المورد على فواتير الشراء
    // =====================================================
    tableSchema({
      name: "payment_allocations",
      columns: [
        { name: "payment_voucher_id", type: "string", isIndexed: true },
        { name: "purchase_invoice_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 23. استهلاك دفعات FIFO عند البيع
    // =====================================================
    tableSchema({
      name: "sale_item_batch_consumptions",
      columns: [
        { name: "sales_invoice_item_id", type: "string", isIndexed: true },
        { name: "batch_id", type: "string", isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "unit_cost", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 24. مرتجع المبيعات - الرأس
    // =====================================================
    tableSchema({
      name: "sales_returns",
      columns: [
        { name: "sales_invoice_id", type: "string", isIndexed: true },
        { name: "customer_id", type: "string", isIndexed: true },
        { name: "return_date", type: "number", isIndexed: true },
        {
          name: "return_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "total", type: "number" },
        { name: "status", type: "string", isIndexed: true },
        { name: "created_by", type: "string" },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 25. تفاصيل مرتجع المبيعات
    // =====================================================
    tableSchema({
      name: "sales_return_items",
      columns: [
        { name: "sales_return_id", type: "string", isIndexed: true },
        { name: "sales_invoice_item_id", type: "string", isIndexed: true },
        { name: "product_id", type: "string", isIndexed: true },
        { name: "product_unit_id", type: "string", isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "unit_price", type: "number" },
        { name: "total", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 26. إعادة الكميات إلى دفعاتها
    // =====================================================
    tableSchema({
      name: "sales_return_batch_allocations",
      columns: [
        { name: "sales_return_item_id", type: "string", isIndexed: true },
        { name: "batch_id", type: "string", isIndexed: true },
        { name: "quantity", type: "number" },
        { name: "unit_cost", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 27. المبالغ المرتجعة للعميل
    // =====================================================
    tableSchema({
      name: "customer_refunds",
      columns: [
        { name: "sales_return_id", type: "string", isIndexed: true },
        { name: "customer_id", type: "string", isIndexed: true },
        { name: "refund_date", type: "number", isIndexed: true },
        {
          name: "refund_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "payment_account_id", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "status", type: "string", isIndexed: true },
        { name: "created_by", type: "string" },
        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        { name: "is_cancelled", type: "boolean" },
        { name: "cancelled_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
  ],
  unsafeSql: (sql: any, kind: string) => {
    if (kind === "setup") {
      return `
      ${sql}

      CREATE UNIQUE INDEX IF NOT EXISTS idx_units_code_unique
      ON units(code);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_unique
      ON products(sku);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_units_barcode_unique
      ON product_units(barcode);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_units_product_unit_unique
      ON product_units(product_id, unit_id);
    `;
    }

    return sql;
  },
});
