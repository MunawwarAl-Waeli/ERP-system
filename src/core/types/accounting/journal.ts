import { ReferenceType } from "../../constants";
import { JournalEntryStatus } from "@core/constants";


export interface JournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  referenceType?: ReferenceType;
  referenceId?: string;
  description?: string;
  createdBy: string;
  idempotencyKey?: string;
  lines: JournalEntryLineInput[];
}

export interface JournalEntryLineData {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
}

export interface JournalEntryData {
  id: string;
  entryDate: string;
  referenceType?: ReferenceType;
  referenceId?: string;
  description?: string;
  status: JournalEntryStatus;
  createdBy: string;
  idempotencyKey?: string;
  isReversed: boolean;
  reversedAt?: string;
  reversalOfId?: string;
  lines: JournalEntryLineData[];
  createdAt: number;
  updatedAt: number;
}