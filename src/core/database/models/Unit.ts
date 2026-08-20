import { Model } from '@nozbe/watermelondb';
import {
  text,
  date,
  readonly,
  children,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Unit extends Model {
  static table = 'units';

  static associations: Associations = {
    product_units: { type: 'has_many' as const, foreignKey: 'unit_id' },
  };

  @text('name') name!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children('product_units') productUnits: any;

  @writer async updateUnit(data: { name?: string }) {
    await this.update((unit: Unit) => {
      if (data.name !== undefined) { unit.name = data.name; }
    });
  }
}
