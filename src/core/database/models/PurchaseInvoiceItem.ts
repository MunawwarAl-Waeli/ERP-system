import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  immutableRelation,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class PurchaseInvoiceItem extends Model {
  static table = 'purchase_invoice_items';

  static associations: Associations = {
    purchase_invoices: { type: 'belongs_to' as const, key: 'purchase_invoice_id' },
    products: { type: 'belongs_to' as const, key: 'product_id' },
    product_units: { type: 'belongs_to' as const, key: 'product_unit_id' },
  };

  @field('purchase_invoice_id') purchaseInvoiceId!: string;
  @field('product_id') productId!: string;
  @field('product_unit_id') productUnitId!: string;
  @field('quantity') quantity!: number;
  @field('unit_cost') unitCost!: number;
  @field('total') total!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('purchase_invoices', 'purchase_invoice_id') purchaseInvoice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('products', 'product_id') product: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('product_units', 'product_unit_id') productUnit: any;

  get calculatedTotal(): number {
    return this.quantity * this.unitCost;
  }

  @writer async updateItem(data: {
    quantity?: number;
    unitCost?: number;
    productUnitId?: string;
  }) {
    await this.update((item: PurchaseInvoiceItem) => {
      if (data.quantity !== undefined) { item.quantity = data.quantity; }
      if (data.unitCost !== undefined) { item.unitCost = data.unitCost; }
      if (data.productUnitId !== undefined) { item.productUnitId = data.productUnitId; }
      
      const qty = data.quantity !== undefined ? data.quantity : item.quantity;
      const cost = data.unitCost !== undefined ? data.unitCost : item.unitCost;
      item.total = qty * cost;
    });
  }
}
