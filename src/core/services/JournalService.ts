/* eslint-disable require-await */
/* eslint-disable arrow-body-style */
import { database } from "@core/database";
import JournalEntry from "@core/database/models/JournalEntry";
import JournalEntryLine from "@core/database/models/JournalEntryLine";
import { Model } from "@nozbe/watermelondb";

const entries = database.get<JournalEntry>("journal_entries");
const linesCollection = database.get<JournalEntryLine>("journal_entry_lines");

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

interface JournalEntryData {
  date: Date;
  description: string;
  lines: JournalLineInput[];
  referenceType?: string | null;
  referenceId?: string | null;
  createdBy?: string | null;
}

/**
 * Internal preparation function. It validates the entry and returns prepared records without saving them.
 * This is the single source of truth for journal entry creation logic.
 */
async function _prepareJournal(data: JournalEntryData): Promise<Model[]> {
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Journal entry is unbalanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
    );
  }

  const preparedOperations: Model[] = [];

  const entry = entries.prepareCreate((e) => {
    e.entryDate = data.date;
    e.description = data.description;
    e.referenceType = data.referenceType ?? null;
    e.referenceId = data.referenceId ?? null;
    e.status = "posted";
    e.createdBy = data.createdBy ?? "";
  });
  preparedOperations.push(entry);

  for (const line of data.lines) {
    const preparedLine = linesCollection.prepareCreate((l) => {
      l.journalEntry.set(entry);
      l.accountId = line.accountId;
      l.debit = line.debit;
      l.credit = line.credit;
    });
    preparedOperations.push(preparedLine);
  }

  return preparedOperations;
}

export const JournalService = {
  /**
   * Prepares journal entry records for batching within a larger transaction.
   * Does NOT write to the database.
   */
  prepareCreateEntry: (data: JournalEntryData): Promise<Model[]> => {
    return _prepareJournal(data);
  },

  /**
   * Creates and immediately persists a journal entry in its own transaction.
   * Use this for standalone journal entries.
   */
  createEntry: async (data: JournalEntryData): Promise<JournalEntry> => {
    const preparedOperations = await _prepareJournal(data);
    return database.write(async () => {
      const batchResult = await database.batch(...preparedOperations);
      // The first operation is the JournalEntry itself
      return batchResult[0] as JournalEntry;
    });
  },

  postEntry: (entry: JournalEntry) =>
    database.write(async () => {
      await entry.update((e) => (e.status = "posted"));
    }),

  cancelEntry: (entry: JournalEntry) =>
    database.write(async () => {
      await entry.update((e) => (e.status = "cancelled"));
    }),
  prepareReverseEntry: async (
    originalEntry: JournalEntry,
    description: string,
    currentUserId?: string,
  ): Promise<Model[]> => {
    const originalLines = await originalEntry.lines.fetch();

    const reversedLines: JournalLineInput[] = originalLines.map(
      (line: JournalEntryLine) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
      }),
    );

    return JournalService.prepareCreateEntry({
      date: new Date(),
      description,
      lines: reversedLines,
      referenceType: "reversal",
      referenceId: originalEntry.id,
      createdBy: currentUserId,
    });
  },
  reverseEntry: async (
    originalEntry: JournalEntry,
    description: string,
    currentUserId?: string,
  ) => {
    // جلب أسطر القيد الأصلي
    const originalLines = await originalEntry.lines.fetch();

    // تحديد نوع line صراحة لحل خطأ any
    const reversedLines: JournalLineInput[] = originalLines.map(
      (line: JournalEntryLine) => ({
        accountId: line.accountId,
        debit: line.credit, // الدائن يصبح مدين
        credit: line.debit, // المدين يصبح دائن
      }),
    );

    // إنشاء القيد العكسي بنفس خدمة إنشاء القيود
    return JournalService.createEntry({
      date: new Date(), // تاريخ الإلغاء
      description,
      lines: reversedLines,
      referenceType: originalEntry.referenceType,
      referenceId: originalEntry.referenceId,
      createdBy: currentUserId,
    });
  },

  createOpeningBalanceEntry: (
    lines: JournalLineInput[],
    date: Date,
    userId?: string,
  ) =>
    JournalService.createEntry({
      date,
      description: "القيد الافتتاحي",
      lines,
      referenceType: "opening_balance",
      createdBy: userId,
    }),
};
