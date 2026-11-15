// models/AccountingPeriod.ts
import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class AccountingPeriod extends Model {
  static table = 'accounting_periods';
  static associations: Associations = {};

  @text('name') name!: string;
  @date('start_date') startDate!: number;
  @date('end_date') endDate!: number;
  @field('is_closed') isClosed!: boolean;
  @date('closed_at') closedAt?: number|null;

  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
