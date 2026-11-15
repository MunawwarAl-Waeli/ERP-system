import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { schema } from "@database/schema";

import AccountingPeriod from "@database/models/AccountingPeriod";
import ChartOfAccount from "@database/models/ChartOfAccount";
import AccountingSetting from "@database/models/AccountingSetting";
import JournalEntry from "@database/models/JournalEntry";
import JournalEntryLine from "@database/models/JournalEntryLine";
import Customer from "@database/models/Customer";
import Supplier from "@database/models/Supplier";
import Category from "@database/models/Category";
import Unit from "@database/models/Unit";
import Product from "@database/models/Product";
import ProductUnit from "@database/models/ProductUnit";
import ProductBatch from "@database/models/ProductBatch";
import StockMovement from "@database/models/StockMovement";
import PurchaseInvoice from "@database/models/PurchaseInvoice";
import PurchaseInvoiceItem from "@database/models/PurchaseInvoiceItem";
import PaymentVoucher from "@database/models/PaymentVoucher";
import PaymentAllocation from "@database/models/PaymentAllocation";
import SalesInvoice from "@database/models/SalesInvoice";
import SalesInvoiceItem from "@database/models/SalesInvoiceItem";
import SaleItemBatchConsumption from "@database/models/SaleItemBatchConsumption";
import ReceiptVoucher from "@database/models/ReceiptVoucher";
import ReceiptAllocation from "@database/models/ReceiptAllocation";
import SalesReturn from "@database/models/SalesReturn";
import SalesReturnItem from "@database/models/SalesReturnItem";
import SalesReturnBatchAllocation from "@database/models/SalesReturnBatchAllocation";
import CustomerRefund from "@database/models/CustomerRefund";

import { WatermelonJournalEntryRepository } from "@infrastructure/watermelon/repositories/WatermelonJournalEntryRepository";

import {
  ACCOUNT_TYPES,
  JOURNAL_ENTRY_STATUSES,
  REFERENCE_TYPES,
} from "@core/constants";

import type { CreateJournalEntryInput } from "@core/types/accounting/journal";

describe("WatermelonJournalEntryRepository", () => {
  let database: Database;
  let repository: WatermelonJournalEntryRepository;

  let cashAccountId: string;
  let supplierAccountId: string;

  beforeEach(async () => {
    const adapter = new LokiJSAdapter({
      schema,
      dbName: `journal-test-${Date.now()}-${Math.random()}`,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });

    database = new Database({
      adapter,

      modelClasses: [
        AccountingPeriod,
        ChartOfAccount,
        AccountingSetting,
        JournalEntry,
        JournalEntryLine,

        Customer,
        Supplier,

        Category,
        Unit,
        Product,
        ProductUnit,
        ProductBatch,
        StockMovement,

        PurchaseInvoice,
        PurchaseInvoiceItem,
        PaymentVoucher,
        PaymentAllocation,

        SalesInvoice,
        SalesInvoiceItem,
        SaleItemBatchConsumption,
        ReceiptVoucher,
        ReceiptAllocation,

        SalesReturn,
        SalesReturnItem,
        SalesReturnBatchAllocation,
        CustomerRefund,
      ],
    });

    repository = new WatermelonJournalEntryRepository(database);

    const accounts = await database.write(async () => {
      const accountCollection = database.get<ChartOfAccount>(
        ChartOfAccount.table,
      );

      const cash = await accountCollection.create((record) => {
        record.code = "1101";
        record.name = "الصندوق";
        record.type = ACCOUNT_TYPES.ASSET;
        record.parentId = null;
        record.allowPosting = true;
        record.isCashAccount = true;
        record.isActive = true;
      });

      const supplier = await accountCollection.create((record) => {
        record.code = "2101";
        record.name = "الموردون";
        record.type = ACCOUNT_TYPES.LIABILITY;
        record.parentId = null;
        record.allowPosting = true;
        record.isCashAccount = false;
        record.isActive = true;
      });

      return {
        cashId: cash.id,
        supplierId: supplier.id,
      };
    });

    cashAccountId = accounts.cashId;
    supplierAccountId = accounts.supplierId;
  });

  afterEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  // =========================================================
  // Helpers
  // =========================================================

  const makeInput = (
    overrides: Partial<CreateJournalEntryInput> = {},
  ): CreateJournalEntryInput => ({
    entryDate: "2026-10-01",
    referenceType: REFERENCE_TYPES.PURCHASE_INVOICE,
    referenceId: "PI-TEST-001",
    description: "اختبار قيد شراء",
    createdBy: "tester",
    idempotencyKey: undefined,

    lines: [
      {
        accountId: cashAccountId,
        debit: 100000,
        credit: 0,
      },
      {
        accountId: supplierAccountId,
        debit: 0,
        credit: 100000,
      },
    ],

    ...overrides,
  });

  const getEntryLines = async (entryId: string) => {
    const lines = await database
      .get<JournalEntryLine>(JournalEntryLine.table)
      .query()
      .fetch();

    return lines.filter((line) => line.journalEntry.id === entryId);
  };

  // =========================================================
  // createDraft
  // =========================================================

  describe("createDraft", () => {
    it("creates a draft journal entry with its lines", async () => {
      const result = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      expect(result.id).toBeDefined();

      expect(result.status).toBe(JOURNAL_ENTRY_STATUSES.DRAFT);

      expect(result.isReversed).toBe(false);

      expect(result.entryDate).toBe("2026-10-01");

      expect(result.referenceType).toBe(REFERENCE_TYPES.PURCHASE_INVOICE);

      expect(result.referenceId).toBe("PI-TEST-001");

      expect(result.description).toBe("اختبار قيد شراء");

      expect(result.lines).toHaveLength(2);

    

      console.log(
        "RESULT LINES:",
        result.lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
        })),
      );

      const persistedLines = await database
        .get<JournalEntryLine>(JournalEntryLine.table)
        .query()
        .fetch();

      console.log(
        "RAW LINES:",
        persistedLines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          rawAccountId: (line._raw as Record<string, unknown>)["account_id"],
          journalEntryId: (line._raw as Record<string, unknown>)[
            "journal_entry_id"
          ],
        })),
      );

      expect(result.lines[0].accountId).toBe(cashAccountId);

      expect(result.lines[1].accountId).toBe(supplierAccountId);
    });

    it("stores optional fields as undefined at the application boundary", async () => {
      const result = await database.write(async () => {
        return repository.createDraft(
          makeInput({
            referenceType: undefined,
            referenceId: undefined,
            description: undefined,
            idempotencyKey: undefined,
          }),
        );
      });

      expect(result.referenceType).toBeUndefined();
      expect(result.referenceId).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.idempotencyKey).toBeUndefined();
      expect(result.reversalOfId).toBeUndefined();
      expect(result.reversedAt).toBeUndefined();
    });

    it("rejects a draft without lines", async () => {
      await expect(
        database.write(async () => {
          return repository.createDraft(
            makeInput({
              lines: [],
            }),
          );
        }),
      ).rejects.toThrow("Journal entry must contain at least one line.");
    });
  });

  // =========================================================
  // getById
  // =========================================================

  describe("getById", () => {
    it("returns an existing journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const result = await repository.getById(created.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
    });

    it("returns null for a missing journal entry", async () => {
      const result = await repository.getById("missing-entry-id");

      expect(result).toBeNull();
    });
  });

  // =========================================================
  // getByReference
  // =========================================================

  describe("getByReference", () => {
    it("returns the operational journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const result = await repository.getByReference(
        REFERENCE_TYPES.PURCHASE_INVOICE,
        "PI-TEST-001",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
    });

    it("does not return a reversal journal as the operational reference", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(original.id, "2026-10-02");
      });

      const result = await repository.getByReference(
        REFERENCE_TYPES.PURCHASE_INVOICE,
        "PI-TEST-001",
      );

      expect(result).not.toBeNull();

      expect(result?.id).toBe(original.id);

      expect(result?.id).not.toBe(reversal.id);
    });
  });

  // =========================================================
  // getByIdempotencyKey
  // =========================================================

  describe("getByIdempotencyKey", () => {
    it("returns the entry by idempotency key", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(
          makeInput({
            idempotencyKey: "journal-idempotency-001",
          }),
        );
      });

      const result = await repository.getByIdempotencyKey(
        "journal-idempotency-001",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(created.id);
    });

    it("returns null when idempotency key does not exist", async () => {
      const result = await repository.getByIdempotencyKey(
        "missing-idempotency-key",
      );

      expect(result).toBeNull();
    });
  });

  // =========================================================
  // getByDateRange
  // =========================================================

  describe("getByDateRange", () => {
    it("returns entries inside the date range", async () => {
      await database.write(async () => {
        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-01",
          }),
        );

        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-05",
            referenceId: "PI-TEST-002",
          }),
        );

        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-15",
            referenceId: "PI-TEST-003",
          }),
        );
      });

      const result = await repository.getByDateRange(
        "2026-10-01",
        "2026-10-05",
      );

      expect(result).toHaveLength(2);

      expect(result.map((entry) => entry.entryDate)).toEqual([
        "2026-10-01",
        "2026-10-05",
      ]);
    });

    it("returns entries sorted ascending by date", async () => {
      await database.write(async () => {
        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-10",
            referenceId: "10",
          }),
        );

        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-01",
            referenceId: "01",
          }),
        );

        await repository.createDraft(
          makeInput({
            entryDate: "2026-10-05",
            referenceId: "05",
          }),
        );
      });

      const result = await repository.getByDateRange(
        "2026-10-01",
        "2026-10-10",
      );

      expect(result.map((entry) => entry.entryDate)).toEqual([
        "2026-10-01",
        "2026-10-05",
        "2026-10-10",
      ]);
    });
  });

  // =========================================================
  // getPostedByReference
  // =========================================================

  describe("getPostedByReference", () => {
    it("returns only a posted operational journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const beforePost = await repository.getPostedByReference(
        REFERENCE_TYPES.PURCHASE_INVOICE,
        "PI-TEST-001",
      );

      expect(beforePost).toBeNull();

      await database.write(async () => {
        await repository.post(created.id);
      });

      const afterPost = await repository.getPostedByReference(
        REFERENCE_TYPES.PURCHASE_INVOICE,
        "PI-TEST-001",
      );

      expect(afterPost).not.toBeNull();

      expect(afterPost?.id).toBe(created.id);
    });
  });

  // =========================================================
  // updateDraft
  // =========================================================

  describe("updateDraft", () => {
    it("updates the draft header and replaces its lines", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const updated = await database.write(async () => {
        return repository.updateDraft(
          created.id,
          makeInput({
            description: "وصف جديد",
            lines: [
              {
                accountId: supplierAccountId,
                debit: 200000,
                credit: 0,
              },
              {
                accountId: cashAccountId,
                debit: 0,
                credit: 200000,
              },
            ],
          }),
        );
      });

      expect(updated.status).toBe(JOURNAL_ENTRY_STATUSES.DRAFT);

      expect(updated.description).toBe("وصف جديد");

      expect(updated.lines).toHaveLength(2);

      expect(
        updated.lines.find((line) => line.accountId === supplierAccountId)
          ?.debit,
      ).toBe(200000);

      const persistedLines = await getEntryLines(created.id);

      expect(persistedLines).toHaveLength(2);
    });

    it("rejects updating a posted journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(created.id);
      });

      await expect(
        database.write(async () => {
          return repository.updateDraft(created.id, makeInput());
        }),
      ).rejects.toThrow("Only draft journal entries can be updated.");
    });

    it("rejects updating a reversed journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(created.id);

        await repository.reverse(created.id, "2026-10-02");
      });

      await expect(
        database.write(async () => {
          return repository.updateDraft(created.id, makeInput());
        }),
      ).rejects.toThrow("Reversed journal entries cannot be updated.");
    });

    it("rejects updating a draft without lines", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await expect(
        database.write(async () => {
          return repository.updateDraft(
            created.id,
            makeInput({
              lines: [],
            }),
          );
        }),
      ).rejects.toThrow("Journal entry must contain at least one line.");
    });
  });

  // =========================================================
  // post
  // =========================================================

  describe("post", () => {
    it("posts a draft journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const posted = await database.write(async () => {
        return repository.post(created.id);
      });

      expect(posted.status).toBe(JOURNAL_ENTRY_STATUSES.POSTED);

      expect(posted.isReversed).toBe(false);
    });

    it("returns the same posted entry when posted again", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      const first = await database.write(async () => {
        return repository.post(created.id);
      });

      const second = await database.write(async () => {
        return repository.post(created.id);
      });

      expect(second.id).toBe(first.id);

      expect(second.status).toBe(JOURNAL_ENTRY_STATUSES.POSTED);

      const lines = await getEntryLines(created.id);

      expect(lines).toHaveLength(2);
    });

    it("rejects posting a reversed journal entry", async () => {
      const created = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(created.id);

        await repository.reverse(created.id, "2026-10-02");
      });

      await expect(
        database.write(async () => {
          return repository.post(created.id);
        }),
      ).rejects.toThrow("Reversed journal entries cannot be posted.");
    });

    it("rejects posting a draft without lines", async () => {
      const created = await database.write(async () => {
        const entries = database.get<JournalEntry>(JournalEntry.table);

        return entries.create((record) => {
          record.entryDate = Date.parse("2026-10-01T00:00:00.000Z");

          record.status = JOURNAL_ENTRY_STATUSES.DRAFT;

          record.createdBy = "tester";

          record.isReversed = false;

          record.referenceType = null;

          record.referenceId = null;

          record.description = null;

          record.idempotencyKey = null;

          record.reversedAt = null;

          record.reversalOfId = null;
        });
      });

      await expect(
        database.write(async () => {
          return repository.post(created.id);
        }),
      ).rejects.toThrow(
        "Journal entry must contain at least one line before posting.",
      );
    });
  });

  // =========================================================
  // reverse
  // =========================================================

  describe("reverse", () => {
    it("creates a posted reversal and marks the original as reversed", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(
          original.id,
          "2026-10-02",
          "عكس قيد الاختبار",
        );
      });

      expect(reversal.status).toBe(JOURNAL_ENTRY_STATUSES.POSTED);

      expect(reversal.isReversed).toBe(false);

      expect(reversal.reversalOfId).toBe(original.id);

      expect(reversal.referenceType).toBeUndefined();

      expect(reversal.referenceId).toBeUndefined();

      expect(reversal.description).toBe("عكس قيد الاختبار");

      const originalAfter = await repository.getById(original.id);

      expect(originalAfter?.status).toBe(JOURNAL_ENTRY_STATUSES.REVERSED);

      expect(originalAfter?.isReversed).toBe(true);

      expect(originalAfter?.reversedAt).toBe("2026-10-02");
    });

    it("reverses debit and credit correctly", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(
          makeInput({
            lines: [
              {
                accountId: cashAccountId,
                debit: 300000,
                credit: 0,
              },
              {
                accountId: supplierAccountId,
                debit: 0,
                credit: 300000,
              },
            ],
          }),
        );
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(original.id, "2026-10-02");
      });

      expect(reversal.lines).toHaveLength(2);

      const cashLine = reversal.lines.find(
        (line) => line.accountId === cashAccountId,
      );

      const supplierLine = reversal.lines.find(
        (line) => line.accountId === supplierAccountId,
      );

      expect(cashLine).toEqual(
        expect.objectContaining({
          debit: 0,
          credit: 300000,
        }),
      );

      expect(supplierLine).toEqual(
        expect.objectContaining({
          debit: 300000,
          credit: 0,
        }),
      );
    });

    it("creates reversal lines with the same accounts as the original", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(original.id, "2026-10-02");
      });

      expect(reversal.lines.map((line) => line.accountId)).toEqual(
        expect.arrayContaining([cashAccountId, supplierAccountId]),
      );
    });

    it("does not allow reversing the same journal twice", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      await database.write(async () => {
        await repository.reverse(original.id, "2026-10-02");
      });

      await expect(
        database.write(async () => {
          return repository.reverse(original.id, "2026-10-03");
        }),
      ).rejects.toThrow("Journal entry has already been reversed.");
    });

    it("does not allow reversing a draft", async () => {
      const draft = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await expect(
        database.write(async () => {
          return repository.reverse(draft.id, "2026-10-02");
        }),
      ).rejects.toThrow("Only posted journal entries can be reversed.");
    });

    it("does not allow reversing a posted journal without lines", async () => {
      const posted = await database.write(async () => {
        const entries = database.get<JournalEntry>(JournalEntry.table);

        return entries.create((record) => {
          record.entryDate = Date.parse("2026-10-01T00:00:00.000Z");

          record.status = JOURNAL_ENTRY_STATUSES.POSTED;

          record.createdBy = "tester";

          record.isReversed = false;

          record.referenceType = null;

          record.referenceId = null;

          record.description = null;

          record.idempotencyKey = null;

          record.reversedAt = null;

          record.reversalOfId = null;
        });
      });

      await expect(
        database.write(async () => {
          return repository.reverse(posted.id, "2026-10-02");
        }),
      ).rejects.toThrow(
        "Journal entry cannot be reversed because it has no lines.",
      );
    });
  });

  // =========================================================
  // Persistence integrity
  // =========================================================

  describe("persistence integrity", () => {
    it("persists reversal_of_id only on the reversal entry", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(original.id, "2026-10-02");
      });

      const originalRecord = await database
        .get<JournalEntry>(JournalEntry.table)
        .find(original.id);

      const reversalRecord = await database
        .get<JournalEntry>(JournalEntry.table)
        .find(reversal.id);

      expect(originalRecord.reversalOfId).toBeNull();

      expect(reversalRecord.reversalOfId).toBe(original.id);
    });

    it("does not create a new operational reference for a reversal", async () => {
      const original = await database.write(async () => {
        return repository.createDraft(makeInput());
      });

      await database.write(async () => {
        await repository.post(original.id);
      });

      const reversal = await database.write(async () => {
        return repository.reverse(original.id, "2026-10-02");
      });

      expect(reversal.referenceType).toBeUndefined();

      expect(reversal.referenceId).toBeUndefined();
    });
  });
});
