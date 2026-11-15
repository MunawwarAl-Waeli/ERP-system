import { ReferenceType } from "../../../../core/constants";

import {
  CreateJournalEntryInput,
  JournalEntryData,
} from "../../../../core/types/accounting/journal";

export interface JournalEntryRepository {
  // Queries

  getById(id: string): Promise<JournalEntryData | null>;

  getByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<JournalEntryData | null>;

  getByIdempotencyKey(idempotencyKey: string): Promise<JournalEntryData | null>;

  getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<JournalEntryData[]>;

  getPostedByReference(
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<JournalEntryData | null>;

  // Draft

  createDraft(input: CreateJournalEntryInput): Promise<JournalEntryData>;

  updateDraft(
    id: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryData>;

  // Lifecycle

  post(id: string): Promise<JournalEntryData>;

  reverse(
    id: string,
    reversalDate: string,
    description?: string,
  ): Promise<JournalEntryData>;
}
