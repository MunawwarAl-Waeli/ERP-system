import { Model } from '@nozbe/watermelondb';
import {
  text,
  date,
  readonly,
  children,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Supplier extends Model {
  static table = 'suppliers';

  static associations: Associations = {
    purchase_invoices: { type: 'has_many' as const, foreignKey: 'supplier_id' },
  };

  @text('name') name!: string;
  @text('phone') phone?: string | null;
  @text('address') address?: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @children('purchase_invoices') purchaseInvoices: any;

  @writer async updateSupplier(data: {
    name?: string;
    phone?: string | null;
    address?: string | null;
  }) {
    await this.update((supplier: Supplier) => {
      if (data.name !== undefined) { supplier.name = data.name; }
      if (data.phone !== undefined) { supplier.phone = data.phone; }
      if (data.address !== undefined) { supplier.address = data.address; }
    });
  }
}
