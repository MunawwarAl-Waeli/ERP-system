import { Model } from '@nozbe/watermelondb';
import {
  text,
  field,
  date,
  readonly,
  immutableRelation,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export type SalesItemType = 'product' | 'service';

export default class SalesInvoiceItem extends Model {
  static table = 'sales_invoice_items';

  static associations: Associations = {
    sales_invoices: { type: 'belongs_to' as const, key: 'sales_invoice_id' },
    products: { type: 'belongs_to' as const, key: 'product_id' },
    product_units: { type: 'belongs_to' as const, key: 'product_unit_id' },
  };

  @field('sales_invoice_id') salesInvoiceId!: string;
  @text('item_type') itemType!: SalesItemType;
  @field('product_id') productId?: string | null;
  @field('product_unit_id') productUnitId?: string | null;
  @text('description') description?: string | null;
  @field('quantity') quantity!: number;
  @field('unit_price') unitPrice!: number;
  @field('cost_at_sale') costAtSale!: number;
  @field('total') total!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('sales_invoices', 'sales_invoice_id') salesInvoice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('products', 'product_id') product: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('product_units', 'product_unit_id') productUnit: any;

  get profitMargin(): number {
    const totalCost = this.quantity * this.costAtSale;
    return this.total - totalCost;
  }

  @writer async updateItem(data: {
    itemType?: SalesItemType;
    productId?: string | null;
    productUnitId?: string | null;
    description?: string | null;
    quantity?: number;
    unitPrice?: number;
    costAtSale?: number;
  }) {
    await this.update((item: SalesInvoiceItem) => {
      if (data.itemType !== undefined) { item.itemType = data.itemType; }
      if (data.productId !== undefined) { item.productId = data.productId; }
      if (data.productUnitId !== undefined) { item.productUnitId = data.productUnitId; }
      if (data.description !== undefined) { item.description = data.description; }
      if (data.quantity !== undefined) { item.quantity = data.quantity; }
      if (data.unitPrice !== undefined) { item.unitPrice = data.unitPrice; }
      if (data.costAtSale !== undefined) { item.costAtSale = data.costAtSale; }

      const qty = data.quantity !== undefined ? data.quantity : item.quantity;
      const price = data.unitPrice !== undefined ? data.unitPrice : item.unitPrice;
      item.total = qty * price;
    });
  }
}
