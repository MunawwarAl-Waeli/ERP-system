import {
  addColumns,
  createTable,
  schemaMigrations,
} from "@nozbe/watermelondb/Schema/migrations";

/**
 * ØªØ±Ø­ÙŠÙ„Ø§Øª additive Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† Ø§Ù„Ø­Ø§Ù„ÙŠØ©.
 * Ø§Ù„Ø¥ØµØ¯Ø§Ø± 3 Ù…Ø­ÙÙˆØ¸ Ù„Ù„ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Ø§Ù„Ø£Ø±Ø´ÙŠÙ Ø§Ù„Ø³Ø§Ø¨Ù‚ØŒ ÙˆØ§Ù„Ø¥ØµØ¯Ø§Ø± 4 ÙŠØ¶ÙŠÙ Ø¬Ø¯ÙˆÙ„
 * Ø§Ù„Ù…ØµØ±ÙˆÙØ§Øª Ø§Ù„Ø°ÙŠ ÙƒØ§Ù†Øª Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© ØªØ³ØªØ®Ø¯Ù…Ù‡ Ø¯ÙˆÙ† ÙˆØ¬ÙˆØ¯Ù‡ ÙÙŠ Ø§Ù„Ù…Ø®Ø·Ø·.
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: "categories",
          columns: [
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
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: "accounting_settings",
          columns: [
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
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: "sales_invoices",
          columns: [
            { name: "service_fee", type: "number" },
            { name: "discount_total", type: "number" },
          ],
        }),
        addColumns({
          table: "accounting_settings",
          columns: [
            {
              name: "service_revenue_account_id",
              type: "string",
              isOptional: true,
              isIndexed: true,
            },
          ],
        }),
      ],
    },
  ],
});
