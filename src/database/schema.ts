import { appSchema, tableSchema } from "@nozbe/watermelondb";

/*
  =========================================================
  MASTER ERP SCHEMA - LOCAL-FIRST ACCOUNTING & INVENTORY
  =========================================================

  Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ø¹Ù…Ø§Ø±ÙŠØ©:

  1. Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ù…Ø§Ù„ÙŠØ© ØªØ®Ø²Ù† ÙƒØ£Ø¹Ø¯Ø§Ø¯ ØµØ­ÙŠØ­Ø©
     Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… ÙˆØ­Ø¯Ø© Ø§Ù„ØªØ®Ø²ÙŠÙ† Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© Ù„Ù„Ù†Ø¸Ø§Ù… (x1000 Ø£Ùˆ x100).

  2. Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ù„Ø§ ØªØ­Ø°Ù.
     ÙŠØªÙ… Ø§Ø³ØªØ®Ø¯Ø§Ù…:
       is_cancelled
       is_reversed

  3. idempotency_key ÙŠÙ…Ù†Ø¹ ØªÙƒØ±Ø§Ø± Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª.

  4. FIFO ÙŠØ¹ØªÙ…Ø¯ Ø¹Ù„Ù‰:
       product_batches.received_date

  5. Ø§Ù„ÙˆØ­Ø¯Ø© Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© Ù„Ù„Ù…Ø®Ø²ÙˆÙ† Ù‡ÙŠ "Ø§Ù„Ø­Ø¨Ø©".
     Ù„Ø°Ù„Ùƒ ÙƒÙ…ÙŠØ§Øª FIFO ÙˆØ­Ø±ÙƒØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© ØªÙƒÙˆÙ† Ø¨Ø§Ù„Ø­Ø¨Ø©.

  6. product_unit_id ÙŠØ­Ø¯Ø¯ ÙˆØ­Ø¯Ø© ØªØ¹Ø§Ù…Ù„ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…
     Ù…Ø«Ù„: Ø­Ø¨Ø©ØŒ ÙƒØ±ØªÙˆÙ†ØŒ ÙƒÙŠØ³.

  7. paid_amount ÙÙŠ Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ù‚ÙŠÙ…Ø© Ù…Ø®Ø²Ù†Ø© Ù…Ø¤Ù‚ØªÙ‹Ø§
     Cache ÙˆÙ„ÙŠØ³Øª Ù…ØµØ¯Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚Ø©.
     Ù…ØµØ¯Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚Ø© Ù‡Ùˆ:
       receipt_allocations
       payment_allocations

  8. Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ù„Ø§ ØªØ³ØªØ®Ø¯Ù… ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª.
     ØªØ³Ø¬Ù„ ÙƒÙ‚ÙŠÙˆØ¯ ÙŠÙˆÙ…ÙŠØ© Ø¹Ø§Ø¯ÙŠØ©.

  9. Ù…Ø±ØªØ¬Ø¹ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ù…Ø³ØªÙ†Ø¯ Ù…Ø³ØªÙ‚Ù„ ÙˆÙ„Ø§ ÙŠØªÙ… ØªØ¹Ø¯ÙŠÙ„
     ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¨ÙŠØ¹ Ø§Ù„Ø£ØµÙ„ÙŠØ© Ø¨Ø¹Ø¯ ØªØ±Ø­ÙŠÙ„Ù‡Ø§.

  10. Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø§Ù„Ù…Ø­Ø§Ø³Ø¨ÙŠØ© Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ù„Ø§ ØªØ­Ø°ÙØŒ
      ÙˆØ¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø© ÙŠØªÙ… Ø¹ÙƒØ³Ù‡Ø§ Ø¨Ù‚ÙŠØ¯ Ø¹ÙƒØ³ÙŠ.
*/

export const schema = appSchema({
  version: 6,

  tables: [
    // =====================================================
    // 1. Ø§Ù„ÙØªØ±Ø§Øª Ø§Ù„Ù…Ø­Ø§Ø³Ø¨ÙŠØ©
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
    // 2. Ø¯Ù„ÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª
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
    // 3. Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø­Ø§Ø³Ø¨Ø©
    // =====================================================

    tableSchema({
      name: "accounting_settings",
      columns: [
        {
          name: "customers_account_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "suppliers_account_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "cash_default_account_id",
          type: "string",
          isIndexed: true,
        },

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

        // ✅ الحسابات الافتراضية للمنتجات بدون تصنيف
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

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 4. Ø§Ù„ÙˆØ­Ø¯Ø§Øª
    // =====================================================

    tableSchema({
      name: "units",
      columns: [
        {
          name: "code",
          type: "string",
          isIndexed: true,
        },

        {
          name: "name",
          type: "string",
          isIndexed: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 5. ÙˆØ­Ø¯Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
    // =====================================================

    tableSchema({
      name: "product_units",
      columns: [
        { name: "product_id", type: "string", isIndexed: true },
        { name: "unit_id", type: "string", isIndexed: true },

        {
          name: "barcode",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        /*
          Ø¹Ø¯Ø¯ Ø§Ù„Ø­Ø¨Ø§Øª Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯Ø© ÙÙŠ ÙˆØ­Ø¯Ø© Ø§Ù„Ø¨ÙŠØ¹.

          Ù…Ø«Ø§Ù„:
          ÙƒØ±ØªÙˆÙ† = 24 Ø­Ø¨Ø©
          conversion_factor = 24
        */
        { name: "conversion_factor", type: "number" },

        { name: "sale_price", type: "number" },
        { name: "purchase_price", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 6. Ø§Ù„Ù…ÙˆØ±Ø¯ÙˆÙ†
    // =====================================================

    tableSchema({
      name: "suppliers",
      columns: [
        {
          name: "name",
          type: "string",
          isIndexed: true,
        },

        {
          name: "phone",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        {
          name: "address",
          type: "string",
          isOptional: true,
        },

        {
          name: "is_active",
          type: "boolean",
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

    // =====================================================
    // 7. Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡
    // =====================================================

    tableSchema({
      name: "customers",
      columns: [
        { name: "name", type: "string", isIndexed: true },
        { name: "phone", type: "string", isIndexed: true },

        {
          name: "address",
          type: "string",
          isOptional: true,
        },

        {
          name: "notes",
          type: "string",
          isOptional: true,
        },

        { name: "is_active", type: "boolean" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 8. Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„ØªØ´ØºÙŠÙ„ÙŠØ©
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
    // 8. Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª
    // =====================================================

    tableSchema({
      name: "categories",
      columns: [
        { name: "name", type: "string" },

        {
          name: "icon",
          type: "string",
          isOptional: true,
        },

        // ✅ حسابات التصنيف (المنتجات ترث منها)
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
    // 9. Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
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

        {
          name: "sku",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "last_purchase_cost", type: "number" },
        { name: "min_stock", type: "number" },

        { name: "is_active", type: "boolean" },

        {
          name: "inventory_account_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "sales_account_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "cogs_account_id",
          type: "string",
          isIndexed: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 10. ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª
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

        /*
          cash / credit / partial
        */
        { name: "payment_type", type: "string" },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string" },

        { name: "total", type: "number" },

        /*
          Cache ÙÙ‚Ø·.
          Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ = payment_allocations
        */
        { name: "paid_amount", type: "number" },

        { name: "created_by", type: "string" },

        /*
          Optional Ù„Ø£Ù† Ø§Ù„Ø´Ø±Ø§Ø¡ Ø§Ù„Ù†Ù‚Ø¯ÙŠ ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠØªÙ…
          Ø¨Ø¯ÙˆÙ† ÙØªØ­ Ø­Ø³Ø§Ø¨ Ù…ÙˆØ±Ø¯.
        */
        {
          name: "supplier_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 11. ØªÙØ§ØµÙŠÙ„ ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª
    // =====================================================

    tableSchema({
      name: "purchase_invoice_items",
      columns: [
        {
          name: "purchase_invoice_id",
          type: "string",
          isIndexed: true,
        },

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

        /*
          ÙƒÙ…ÙŠØ© Ø¨ÙˆØ­Ø¯Ø© Ø§Ù„ØªØ¹Ø§Ù…Ù„.
          ÙŠØªÙ… ØªØ­ÙˆÙŠÙ„Ù‡Ø§ Ø¥Ù„Ù‰ Ø­Ø¨Ø§Øª Ø¹Ù†Ø¯ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø¨Ø§ØªØ´
          ÙˆØ­Ø±ÙƒØ© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†.
        */
        { name: "quantity", type: "number" },

        { name: "unit_cost", type: "number" },
        { name: "total", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 12. Ø¯ÙØ¹Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† FIFO
    // =====================================================

    tableSchema({
      name: "product_batches",
      columns: [
        {
          name: "product_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "purchase_item_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        /*
          Ø¯Ø§Ø¦Ù…Ù‹Ø§ Ø¨Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "quantity_received", type: "number" },

        /*
          Ø¯Ø§Ø¦Ù…Ù‹Ø§ Ø¨Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "quantity_remaining", type: "number" },

        /*
          ØªÙƒÙ„ÙØ© Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "unit_cost", type: "number" },

        /*
          ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„ÙØ¹Ù„ÙŠ.
          ÙŠØ³ØªØ®Ø¯Ù… ÙÙŠ FIFO.
        */
        {
          name: "received_date",
          type: "number",
          isIndexed: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 13. ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª
    // =====================================================

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

        { name: "invoice_date", type: "number", isIndexed: true },

        /*
          cash / credit / partial
        */
        { name: "payment_type", type: "string" },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string", isIndexed: true },

        { name: "total", type: "number" },

        /*
          Cache ÙÙ‚Ø·.
          Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ = receipt_allocations
        */
        { name: "paid_amount", type: "number" },

        { name: "created_by", type: "string" },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 14. ØªÙØ§ØµÙŠÙ„ ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª
    // =====================================================

    tableSchema({
      name: "sales_invoice_items",
      columns: [
        {
          name: "sales_invoice_id",
          type: "string",
          isIndexed: true,
        },

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

        /*
          ÙƒÙ…ÙŠØ© Ø¨ÙˆØ­Ø¯Ø© Ø§Ù„Ø¨ÙŠØ¹.
          ÙŠØªÙ… ØªØ­ÙˆÙŠÙ„Ù‡Ø§ Ø¯Ø§Ø®Ù„ÙŠÙ‹Ø§ Ø¥Ù„Ù‰ Ø­Ø¨Ø§Øª.
        */
        { name: "quantity", type: "number" },
        { name: "base_quantity", type: "number" },
        { name: "unit_price", type: "number" },

        /*
          Cache Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ ØªÙƒÙ„ÙØ© Ø§Ù„ØµÙ†Ù.
          Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„ØªÙØµÙŠÙ„ÙŠ = sale_item_batch_consumptions
        */
        { name: "cost_at_sale", type: "number" },

        { name: "total", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 15. Ø­Ø±ÙƒØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
    // =====================================================

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

        /*
          Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© Ø¯Ø§Ø¦Ù…Ù‹Ø§ Ø¨Ø§Ù„Ø­Ø¨Ø©.
          Ù…ÙˆØ¬Ø¨ = Ø¯Ø®ÙˆÙ„
          Ø³Ø§Ù„Ø¨ = Ø®Ø±ÙˆØ¬
        */
        { name: "quantity", type: "number" },

        /*
          purchase
          sale
          sale_return
          adjustment
          ...
        */
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

        /*
          ØªÙƒÙ„ÙØ© Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "unit_cost", type: "number" },

        { name: "movement_date", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 16. Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©
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

        {
          name: "description",
          type: "string",
          isOptional: true,
        },

        /*
          draft / posted / reversed
        */
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
        {
          name: "reversed_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 17. ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©
    // =====================================================

    tableSchema({
      name: "journal_entry_lines",
      columns: [
        {
          name: "journal_entry_id",
          type: "string",
          isIndexed: true,
        },
        {
          name: "line_order",
          type: "number",
          isIndexed: true,
        },
        {
          name: "account_id",
          type: "string",
          isIndexed: true,
        },

        { name: "debit", type: "number" },
        { name: "credit", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 18. ØªØ­ØµÙŠÙ„Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡
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

        /*
          Ø­Ø³Ø§Ø¨ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ Ø£Ùˆ Ø§Ù„Ø¨Ù†Ùƒ
        */
        {
          name: "payment_account_id",
          type: "string",
          isIndexed: true,
        },

        /*
          Ø§Ù„ØªØ­ØµÙŠÙ„ Ø®Ø§Øµ Ø¨Ø¹Ù…ÙŠÙ„.
        */
        {
          name: "customer_id",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "amount", type: "number" },

        {
          name: "description",
          type: "string",
          isOptional: true,
        },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string" },

        { name: "created_by", type: "string" },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 19. ØªÙˆØ²ÙŠØ¹ Ø§Ù„ØªØ­ØµÙŠÙ„ Ø¹Ù„Ù‰ ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡
    // =====================================================

    tableSchema({
      name: "receipt_allocations",
      columns: [
        {
          name: "receipt_voucher_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "sales_invoice_id",
          type: "string",
          isIndexed: true,
        },

        { name: "amount", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 20. Ø³Ø¯Ø§Ø¯ Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†
    // =====================================================

    tableSchema({
      name: "payment_vouchers",
      columns: [
        { name: "voucher_number", type: "string", isIndexed: true },

        { name: "voucher_date", type: "number", isIndexed: true },

        /*
          Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ Ø£Ùˆ Ø§Ù„Ø¨Ù†Ùƒ
        */
        {
          name: "payment_account_id",
          type: "string",
          isIndexed: true,
        },

        /*
          Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø®Ø§Øµ Ø¨Ù…ÙˆØ±Ø¯.
        */
        {
          name: "supplier_id",
          type: "string",
          isIndexed: true,
        },

        { name: "amount", type: "number" },

        {
          name: "description",
          type: "string",
          isOptional: true,
        },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string" },

        { name: "created_by", type: "string" },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 21. ØªÙˆØ²ÙŠØ¹ Ø³Ø¯Ø§Ø¯ Ø§Ù„Ù…ÙˆØ±Ø¯ Ø¹Ù„Ù‰ ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ø´Ø±Ø§Ø¡
    // =====================================================

    tableSchema({
      name: "payment_allocations",
      columns: [
        {
          name: "payment_voucher_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "purchase_invoice_id",
          type: "string",
          isIndexed: true,
        },

        { name: "amount", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 22. Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ Ø¯ÙØ¹Ø§Øª FIFO Ø¹Ù†Ø¯ Ø§Ù„Ø¨ÙŠØ¹
    // =====================================================

    tableSchema({
      name: "sale_item_batch_consumptions",
      columns: [
        {
          name: "sales_invoice_item_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "batch_id",
          type: "string",
          isIndexed: true,
        },

        /*
          Ø¯Ø§Ø¦Ù…Ù‹Ø§ Ø¨Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "quantity", type: "number" },

        /*
          ØªÙƒÙ„ÙØ© Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "unit_cost", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 23. Ù…Ø±ØªØ¬Ø¹Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª - Ø§Ù„Ø±Ø£Ø³
    // =====================================================

    tableSchema({
      name: "sales_returns",
      columns: [
        {
          name: "sales_invoice_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "customer_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "return_date",
          type: "number",
          isIndexed: true,
        },
        {
          name: "return_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        /*
          Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø±ØªØ¬Ø¹ Ø¨Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹
        */
        { name: "total", type: "number" },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string", isIndexed: true },

        { name: "created_by", type: "string" },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 24. ØªÙØ§ØµÙŠÙ„ Ù…Ø±ØªØ¬Ø¹ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª
    // =====================================================

    tableSchema({
      name: "sales_return_items",
      columns: [
        {
          name: "sales_return_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "sales_invoice_item_id",
          type: "string",
          isIndexed: true,
        },

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

        /*
          ÙƒÙ…ÙŠØ© Ø¨ÙˆØ­Ø¯Ø© Ø§Ù„Ø¨ÙŠØ¹.
          ÙŠØªÙ… ØªØ­ÙˆÙŠÙ„Ù‡Ø§ Ø¥Ù„Ù‰ Ø­Ø¨Ø§Øª Ø¯Ø§Ø®Ù„ÙŠÙ‹Ø§.
        */
        { name: "quantity", type: "number" },

        /*
          Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹ Ø§Ù„Ø£ØµÙ„ÙŠ
        */
        { name: "unit_price", type: "number" },

        { name: "total", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 25. Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø¥Ù„Ù‰ Ø¯ÙØ¹Ø§ØªÙ‡Ø§
    // =====================================================

    tableSchema({
      name: "sales_return_batch_allocations",
      columns: [
        {
          name: "sales_return_item_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "batch_id",
          type: "string",
          isIndexed: true,
        },

        /*
          Ø¯Ø§Ø¦Ù…Ù‹Ø§ Ø¨Ø§Ù„Ø­Ø¨Ø©
        */
        { name: "quantity", type: "number" },

        /*
          ØªÙƒÙ„ÙØ© Ø§Ù„Ø­Ø¨Ø© Ø§Ù„ØªÙŠ Ø£Ø¹ÙŠØ¯Øª Ù„Ù„Ù…Ø®Ø²ÙˆÙ†
        */
        { name: "unit_cost", type: "number" },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),

    // =====================================================
    // 26. Ø§Ù„Ù…Ø¨Ø§Ù„Øº Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø© Ù„Ù„Ø¹Ù…ÙŠÙ„
    // =====================================================

    tableSchema({
      name: "customer_refunds",
      columns: [
        {
          name: "sales_return_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "customer_id",
          type: "string",
          isIndexed: true,
        },

        {
          name: "refund_date",
          type: "number",
          isIndexed: true,
        },
        {
          name: "refund_number",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },
        /*
          Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ Ø£Ùˆ Ø§Ù„Ø¨Ù†Ùƒ Ø§Ù„Ø°ÙŠ Ø®Ø±Ø¬ Ù…Ù†Ù‡ Ø§Ù„Ù…Ø¨Ù„Øº
        */
        {
          name: "payment_account_id",
          type: "string",
          isIndexed: true,
        },

        { name: "amount", type: "number" },

        /*
          draft / posted / cancelled
        */
        { name: "status", type: "string", isIndexed: true },

        { name: "created_by", type: "string" },

        {
          name: "idempotency_key",
          type: "string",
          isOptional: true,
          isIndexed: true,
        },

        { name: "is_cancelled", type: "boolean" },

        {
          name: "cancelled_at",
          type: "number",
          isOptional: true,
        },

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


