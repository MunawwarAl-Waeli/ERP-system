import { Model } from '@nozbe/watermelondb';
import {
  text,
  field,
  date,
  readonly,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class AccountingPeriod extends Model {
  static table = 'accounting_periods';

  static associations: Associations = {};

  @text('name') name!: string;
  @date('start_date') startDate!: Date;
  @date('end_date') endDate!: Date;
  @field('is_closed') isClosed!: boolean;
  @date('closed_at') closedAt?: Date | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get isActive(): boolean {
    const now = new Date();
    return !this.isClosed && now >= this.startDate && now <= this.endDate;
  }

  @writer async updatePeriod(data: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    await this.update((period: AccountingPeriod) => {
      if (data.name !== undefined) { period.name = data.name; }
      if (data.startDate !== undefined) { period.startDate = data.startDate; }
      if (data.endDate !== undefined) { period.endDate = data.endDate; }
    });
  }

  @writer async closePeriod() {
    await this.update((period: AccountingPeriod) => {
      period.isClosed = true;
      period.closedAt = new Date();
    });
  }

  @writer async reopenPeriod() {
    await this.update((period: AccountingPeriod) => {
      period.isClosed = false;
      period.closedAt = null;
    });
  }
}
