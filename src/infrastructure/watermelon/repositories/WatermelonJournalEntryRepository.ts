import { Database, Q } from "@nozbe/watermelondb";

import JournalEntry from "src/database/models/JournalEntry";
import JournalEntryLine from "src/database/models/JournalEntryLine";

import {
  JOURNAL_ENTRY_STATUSES,
  ReferenceType,
  JournalEntryStatus,
} from "@core/constants";

import {
  CreateJournalEntryInput,
  JournalEntryData,
  JournalEntryLineData,
} from "@core/types/accounting/journal";

import { JournalEntryRepository } from "@application/features/accounting/repositories/JournalEntryRepository";

export class WatermelonJournalEntryRepository
  implements JournalEntryRepository
{
  private readonly entries;
  private readonly lines;

  constructor(private readonly database: Database) {
    this.entries = this.database.get<JournalEntry>(JournalEntry.table);

    this.lines = this.database.get<JournalEntryLine>(JournalEntryLine.table);
  }

  // =========================================================
  // Queries
  // =========================================================

  async getById(id: string): Promise<JournalEntryData | null> {
    const record = await this.findEntry(id);

    if (!record) {
      return null;
    }

    return this.toData(record);
  }

  async getByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<JournalEntryData | null> {
    const records = await this.entries
      .query(
        Q.where("reference_type", referenceType),
        Q.where("reference_id", referenceId),
        Q.where("reversal_of_id", null),
        Q.take(1),
      )
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  async getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<JournalEntryData | null> {
    const records = await this.entries
      .query(Q.where("idempotency_key", idempotencyKey), Q.take(1))
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  async getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<JournalEntryData[]> {
    const startTimestamp = this.toTimestamp(startDate);
    const endTimestamp = this.toTimestamp(endDate);

    const records = await this.entries
      .query(
        Q.where("entry_date", Q.gte(startTimestamp)),
        Q.where("entry_date", Q.lte(endTimestamp)),
        Q.sortBy("entry_date", Q.asc),
      )
      .fetch();

    return Promise.all(records.map((record: JournalEntry) => this.toData(record)));
  }

  async getPostedByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<JournalEntryData | null> {
    const records = await this.entries
      .query(
        Q.where("reference_type", referenceType),
        Q.where("reference_id", referenceId),
        Q.where("status", JOURNAL_ENTRY_STATUSES.POSTED),
        Q.where("reversal_of_id", null),
        Q.take(1),
      )
      .fetch();

    if (records.length === 0) {
      return null;
    }

    return this.toData(records[0]);
  }

  // =========================================================
  // Draft creation
  // =========================================================

  async createDraft(input: CreateJournalEntryInput): Promise<JournalEntryData> {
    const entry = await this.entries.create((record: { entryDate: number; referenceType: string | null; referenceId: string | null; description: string | null; status: string; createdBy: string; idempotencyKey: string | null; isReversed: boolean; reversedAt: null; reversalOfId: null; }) => {
      record.entryDate = this.toTimestamp(input.entryDate);

      record.referenceType = input.referenceType ?? null;

      record.referenceId = input.referenceId ?? null;

      record.description = input.description ?? null;

      record.status = JOURNAL_ENTRY_STATUSES.DRAFT;

      record.createdBy = input.createdBy;

      record.idempotencyKey = input.idempotencyKey ?? null;

      record.isReversed = false;

      record.reversedAt = null;

      record.reversalOfId = null;
    });

    await this.createLines(entry, input.lines);

    return this.toData(entry);
  }

  // =========================================================
  // Draft update
  // =========================================================

  async updateDraft(
    id: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryData> {
    const entry = await this.entries.find(id);

    if (entry.isReversed) {
      throw new Error("Reversed journal entries cannot be updated.");
    }

    if (entry.status !== JOURNAL_ENTRY_STATUSES.DRAFT) {
      throw new Error("Only draft journal entries can be updated.");
    }

    const oldLines = await entry.lines.fetch();

    if (oldLines.length > 0) {
      await this.database.batch(
        ...oldLines.map((line: { prepareDestroyPermanently: () => any; }) => line.prepareDestroyPermanently()),
      );
    }

    await entry.update((record: { entryDate: number; referenceType: string | null; referenceId: string | null; description: string | null; createdBy: string; idempotencyKey: string | null; isReversed: boolean; reversedAt: null; reversalOfId: null; }) => {
      record.entryDate = this.toTimestamp(input.entryDate);

      record.referenceType = input.referenceType ?? null;

      record.referenceId = input.referenceId ?? null;

      record.description = input.description ?? null;

      record.createdBy = input.createdBy;

      record.idempotencyKey = input.idempotencyKey ?? null;

      record.isReversed = false;

      record.reversedAt = null;

      record.reversalOfId = null;
    });

    await this.createLines(entry, input.lines);

    return this.toData(entry);
  }

  // =========================================================
  // Posting
  // =========================================================

  async post(id: string): Promise<JournalEntryData> {
    const entry = await this.entries.find(id);

    if (entry.isReversed) {
      throw new Error("Reversed journal entries cannot be posted.");
    }

    if (entry.status === JOURNAL_ENTRY_STATUSES.POSTED) {
      return this.toData(entry);
    }

    if (entry.status !== JOURNAL_ENTRY_STATUSES.DRAFT) {
      throw new Error(
        `Journal entry cannot be posted from status: ${entry.status}`,
      );
    }

    const entryLines = await entry.lines.fetch();

    if (entryLines.length === 0) {
      throw new Error(
        "Journal entry must contain at least one line before posting.",
      );
    }

    await entry.update((record: { status: string; }) => {
      record.status = JOURNAL_ENTRY_STATUSES.POSTED;
    });

    return this.toData(entry);
  }

  // =========================================================
  // Reversal
  // =========================================================

  async reverse(
    id: string,
    reversalDate: string,
    description?: string,
  ): Promise<JournalEntryData> {
    const original = await this.entries.find(id);

    if (original.isReversed) {
      throw new Error("Journal entry has already been reversed.");
    }

    if (original.status !== JOURNAL_ENTRY_STATUSES.POSTED) {
      throw new Error("Only posted journal entries can be reversed.");
    }

    const originalLines = await original.lines.fetch();

    if (originalLines.length === 0) {
      throw new Error(
        "Journal entry cannot be reversed because it has no lines.",
      );
    }

    const reversalEntry = await this.entries.create((record: { entryDate: number; referenceType: null; referenceId: null; description: string; status: string; createdBy: any; idempotencyKey: null; isReversed: boolean; reversedAt: null; reversalOfId: any; }) => {
      record.entryDate = this.toTimestamp(reversalDate);

      /*
       * The reversal is linked to the original
       * through reversalOfId.
       *
       * It must not masquerade as a new
       * operational reference.
       */
      record.referenceType = null;
      record.referenceId = null;

      record.description =
        description ?? `Reversal of journal entry ${original.id}`;

      record.status = JOURNAL_ENTRY_STATUSES.POSTED;

      record.createdBy = original.createdBy;

      record.idempotencyKey = null;

      record.isReversed = false;

      record.reversedAt = null;

      record.reversalOfId = original.id;
    });

    await this.database.batch(
      ...originalLines.map((line: { accountId: any; credit: any; debit: any; }, index: any) =>
        this.lines.prepareCreate((record: { journalEntry: { set: (arg0: any) => void; }; accountId: any; debit: any; credit: any; lineOrder: any; }) => {
          record.journalEntry.set(reversalEntry);
          record.accountId = line.accountId;
          record.debit = line.credit;
          record.credit = line.debit;
          record.lineOrder = index;
        }),
      ),
    );

    await original.update((record: { status: string; isReversed: boolean; reversedAt: number; }) => {
      record.status = JOURNAL_ENTRY_STATUSES.REVERSED;

      record.isReversed = true;

      record.reversedAt = this.toTimestamp(reversalDate);
    });

    return this.toData(reversalEntry);
  }

  // =========================================================
  // Private: Lines
  // =========================================================

  private async createLines(
    entry: JournalEntry,
    inputLines: CreateJournalEntryInput["lines"],
  ): Promise<void> {
    if (inputLines.length === 0) {
      throw new Error("Journal entry must contain at least one line.");
    }

    await this.database.batch(
      ...inputLines.map((line, index) =>
        this.lines.prepareCreate((record: { journalEntry: { set: (arg0: JournalEntry) => void; }; accountId: string; debit: number; credit: number; lineOrder: number; }) => {
          record.journalEntry.set(entry);
          record.accountId = line.accountId;
          record.debit = line.debit;
          record.credit = line.credit;
          record.lineOrder = index;
        }),
      ),
    );
  }

  // =========================================================
  // Private: Mapping
  // =========================================================

  private async toData(entry: JournalEntry): Promise<JournalEntryData> {
    const lines = await entry.lines
      .extend(Q.sortBy("line_order", Q.asc))
      .fetch();

    return {
      id: entry.id,

      entryDate: this.fromTimestamp(entry.entryDate),

      referenceType: entry.referenceType
        ? (entry.referenceType as ReferenceType)
        : undefined,
      referenceId: entry.referenceId ?? undefined, // âœ… Ù…Ù…ØªØ§Ø²! Ø£Ø®Ø°Øª Ø§Ù„Ù€ null Ù…Ù† Ø§Ù„Ø¯Ø§ØªØ§Ø¨ÙŠØ² ÙˆØ­ÙˆÙ„ØªÙ‡ Ù„Ù€ undefined

      description: entry.description ?? undefined,

      status: entry.status as JournalEntryStatus,

      createdBy: entry.createdBy,

      idempotencyKey: entry.idempotencyKey ?? undefined,

      isReversed: entry.isReversed,

      reversedAt: entry.reversedAt
        ? this.fromTimestamp(entry.reversedAt)
        : undefined,

      reversalOfId: entry.reversalOfId ?? undefined,

      lines: lines.map((line: JournalEntryLine) => this.toLineData(line)),

      createdAt: entry.createdAt,

      updatedAt: entry.updatedAt,
    };
  }

  private toLineData(line: JournalEntryLine): JournalEntryLineData {
    return {
      id: line.id,

      accountId: line.accountId,

      debit: line.debit,

      credit: line.credit,
    };
  }

  // =========================================================
  // Private: Find
  // =========================================================

  private async findEntry(id: string): Promise<JournalEntry | null> {
    try {
      return await this.entries.find(id);
    } catch {
      return null;
    }
  }

  // =========================================================
  // Private: Date conversion
  // =========================================================

  private toTimestamp(date: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date. Expected YYYY-MM-DD: ${date}`);
    }

    const timestamp = Date.parse(`${date}T00:00:00.000Z`);

    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid date: ${date}`);
    }

    return timestamp;
  }

  private fromTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}



