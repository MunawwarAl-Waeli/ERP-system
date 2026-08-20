import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  immutableRelation,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class JournalEntryLine extends Model {
  static table = 'journal_entry_lines';

  static associations: Associations = {
    journal_entries: { type: 'belongs_to' as const, key: 'journal_entry_id' },
    chart_of_accounts: { type: 'belongs_to' as const, key: 'account_id' },
  };

  @field('journal_entry_id') journalEntryId!: string;
  @field('account_id') accountId!: string;
  @field('debit') debit!: number;
  @field('credit') credit!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('journal_entries', 'journal_entry_id') journalEntry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('chart_of_accounts', 'account_id') account: any;

  get isDebit(): boolean {
    return this.debit > 0;
  }

  get isCredit(): boolean {
    return this.credit > 0;
  }

  @writer async updateLine(data: {
    accountId?: string;
    debit?: number;
    credit?: number;
  }) {
    await this.update((line: JournalEntryLine) => {
      if (data.accountId !== undefined) { line.accountId = data.accountId; }
      if (data.debit !== undefined) { line.debit = data.debit; }
      if (data.credit !== undefined) { line.credit = data.credit; }
    });
  }
}
