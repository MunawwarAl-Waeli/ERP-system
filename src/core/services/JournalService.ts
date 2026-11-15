import { database } from "src/database";
import JournalEntry from "src/database/models/JournalEntry";
import JournalEntryLine from "src/database/models/JournalEntryLine";
import { BaseCommand, IntegerMoney, Timestamp } from "@core/types";
import { Model, Q } from "@nozbe/watermelondb";

const entriesCollection = database.get<JournalEntry>("journal_entries");
const linesCollection = database.get<JournalEntryLine>("journal_entry_lines");

export interface JournalLineInput {
  accountId: string;
  debit: IntegerMoney;
  credit: IntegerMoney;
}

export interface CreateJournalEntryCommand extends BaseCommand {
  entryDate: Timestamp;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  lines: JournalLineInput[];
}

/**
 * دالة التحضير الداخلية الصارمة
 * تُنشئ كائنات الـ Models في الذاكرة وتُرجع العمليات مع كائن القيد الأساسي مباشرة.
 */
async function _prepareJournal(
  command: CreateJournalEntryCommand,
): Promise<{ operations: Model[]; entry: JournalEntry }> {
  if (!command.idempotencyKey?.trim()) {
    throw new Error(
      "ACCOUNTING_IDEMPOTENCY_ERROR: idempotencyKey is required.",
    );
  }

  const existingEntries = await entriesCollection
    .query(Q.where("idempotency_key", command.idempotencyKey))
    .fetch();
  if (existingEntries.length > 0) {
    return { operations: [], entry: existingEntries[0] };
  }

  const totalDebit = command.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = command.lines.reduce((sum, line) => sum + line.credit, 0);

  if (command.lines.length === 0 || totalDebit !== totalCredit) {
    throw new Error(
      `ACCOUNTING_BALANCE_ERROR: Journal entry is unbalanced. Total Debit (${totalDebit}) must equal Total Credit (${totalCredit}).`,
    );
  }

  for (const line of command.lines) {
    if (!line.accountId?.trim()) {
      throw new Error("ACCOUNTING_LINE_ERROR: accountId is required.");
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `ACCOUNTING_LINE_ERROR: A single journal line cannot have both debit and credit greater than zero.`,
      );
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error(
        `ACCOUNTING_LINE_ERROR: Debit and credit amounts cannot be negative.`,
      );
    }
  }

  const preparedOperations: Model[] = [];

  // إنشاء رأس القيد في الذاكرة (متاح مباشرة للاستخدام)
  const entry = await entriesCollection.prepareCreate((e) => {
    e.entryDate = command.entryDate;
    e.description = command.description ?? "";
    e.referenceType = command.referenceType ?? undefined;
    e.referenceId = command.referenceId ?? undefined;
    e.status = "posted";
    e.createdBy = command.createdBy;
    e.idempotencyKey = command.idempotencyKey;
    e.isReversed = false;
  });
  preparedOperations.push(entry);

  // إنشاء أسطر القيد في الذاكرة
  for (const line of command.lines) {
    const preparedLine = linesCollection.prepareCreate((l) => {
      l.journalEntry.set(entry);
      l.accountId = line.accountId;
      l.debit = line.debit;
      l.credit = line.credit;
    });
    preparedOperations.push(preparedLine);
  }

  return { operations: preparedOperations, entry };
}

export const JournalService = {
  /**
   * تحضير سجلات القيد لدمجها في معاملة أكبر (Batching).
   */
  prepareCreateEntry: async (
    command: CreateJournalEntryCommand,
  ): Promise<Model[]> => {
    const { operations } = await _prepareJournal(command);
    return operations;
  },

  /**
   * إنشاء وحفظ قيد محاسبي مستقل بذاته بشكل ذري آمن.
   */
  createEntry: async (
    command: CreateJournalEntryCommand,
  ): Promise<JournalEntry> => {
    const { operations, entry } = await _prepareJournal(command);

    await database.write(async () => {
      await database.batch(...operations); // database.batch تُرجع void، لذا لا ننتظر منها نتيجة
    });

    return entry; // نُرجع كائن الـ entry الذي تم تحضيره مسبقاً بكل ثقة
  },

  /**
   * تحضير عملية عكس قيد محاسبي.
   */
  prepareReverseEntry: async (
    originalEntry: JournalEntry,
    reason: string,
    command: BaseCommand,
    reversalTimestamp: Timestamp,
  ): Promise<{ operations: Model[]; reversalEntry: JournalEntry }> => {
    if (originalEntry.isReversed) {
      throw new Error(
        `REVERSAL_ERROR: Journal entry [${originalEntry.id}] has already been reversed.`,
      );
    }

    const originalLines = await originalEntry.lines.fetch();

    const reversedLines: JournalLineInput[] = originalLines.map(
      (line: JournalEntryLine) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
      }),
    );

    const reversalCommand: CreateJournalEntryCommand = {
      ...command,
      entryDate: reversalTimestamp,
      description: `قيد عكسي للقيد رقم [${originalEntry.id}]. السبب: ${reason}`,
      referenceType: originalEntry.referenceType ?? undefined,
      referenceId: originalEntry.id,
      lines: reversedLines,
    };

    const { operations: reversalOperations, entry: reversalEntry } =
      await _prepareJournal(reversalCommand);

    const updateOriginalOperation = originalEntry.prepareUpdate((e) => {
      e.isReversed = true;
      e.reversedAt = reversalTimestamp;
    });

    return {
      operations: [...reversalOperations, updateOriginalOperation],
      reversalEntry,
    };
  },

  /**
   * تنفيذ عكس القيد المحاسبي فورياً بشكل ذري.
   */
  reverseEntry: async (
    originalEntry: JournalEntry,
    reason: string,
    command: BaseCommand,
  ): Promise<JournalEntry> => {
    const reversalTimestamp = Date.now();
    const { operations, reversalEntry } =
      await JournalService.prepareReverseEntry(
        originalEntry,
        reason,
        command,
        reversalTimestamp,
      );

    await database.write(async () => {
      await database.batch(...operations);
    });

    return reversalEntry;
  },

  /**
   * إنشاء القيد الافتتاحي.
   */
  createOpeningBalanceEntry: (
    lines: JournalLineInput[],
    entryDate: Timestamp,
    command: BaseCommand,
  ): Promise<JournalEntry> =>
    JournalService.createEntry({
      ...command,
      entryDate,
      description: "القيد الافتتاحي للنظام",
      referenceType: "opening_balance",
      lines,
    }),
};
