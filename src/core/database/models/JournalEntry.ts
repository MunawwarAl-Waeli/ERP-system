import { Model } from '@nozbe/watermelondb';
import {
  text,
  field,
  date,
  readonly,
  children,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';

export default class JournalEntry extends Model {
  static table = 'journal_entries';

  static associations: Associations = {
    journal_entry_lines: { type: 'has_many' as const, foreignKey: 'journal_entry_id' },
  };

  @date('entry_date') entryDate!: Date;
  @text('reference_type') referenceType?: string | null;
  @text('reference_id') referenceId?: string | null;
  @text('description') description?: string | null;
  @text('status') status!: JournalEntryStatus;
  @field('created_by') createdBy!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children('journal_entry_lines') lines: any;

  get isDraft(): boolean {
    return this.status === 'draft';
  }

  get isPosted(): boolean {
    return this.status === 'posted';
  }

  get isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  @writer async updateEntry(data: {
    entryDate?: Date;
    referenceType?: string | null;
    referenceId?: string | null;
    description?: string | null;
    status?: JournalEntryStatus;
  }) {
    await this.update((entry: JournalEntry) => {
      if (data.entryDate !== undefined) { entry.entryDate = data.entryDate; }
      if (data.referenceType !== undefined) { entry.referenceType = data.referenceType; }
      if (data.referenceId !== undefined) { entry.referenceId = data.referenceId; }
      if (data.description !== undefined) { entry.description = data.description; }
      if (data.status !== undefined) { entry.status = data.status; }
    });
  }

  @writer async post() {
    await this.update((entry: JournalEntry) => {
      entry.status = 'posted';
    });
  }

  @writer async cancel() {
    await this.update((entry: JournalEntry) => {
      entry.status = 'cancelled';
    });
  }
}
