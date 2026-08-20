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

export default class ProductUnit extends Model {
  static table = 'product_units';

  static associations: Associations = {
    products: { type: 'belongs_to' as const, key: 'product_id' },
    units: { type: 'belongs_to' as const, key: 'unit_id' },
    purchase_invoice_items: { type: 'has_many' as const, foreignKey: 'product_unit_id' },
  };

  @field('product_id') productId!: string;
  @field('unit_id') unitId!: string;
  @text('barcode') barcode?: string | null;
  @field('conversion_factor') conversionFactor!: number;
  @field('sale_price') salePrice!: number;
  @field('purchase_price') purchasePrice!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('products', 'product_id') product: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @immutableRelation('units', 'unit_id') unit: any;

  get profitMargin(): number {
    if (this.salePrice === 0) { return 0; }
    return ((this.salePrice - this.purchasePrice) / this.salePrice) * 100;
  }

  @writer async updateUnitConfig(data: {
    unitId?: string;
    barcode?: string | null;
    conversionFactor?: number;
    salePrice?: number;
    purchasePrice?: number;
  }) {
    await this.update((unitConfig: ProductUnit) => {
      if (data.unitId !== undefined) { unitConfig.unitId = data.unitId; }
      if (data.barcode !== undefined) { unitConfig.barcode = data.barcode; }
      if (data.conversionFactor !== undefined) { unitConfig.conversionFactor = data.conversionFactor; }
      if (data.salePrice !== undefined) { unitConfig.salePrice = data.salePrice; }
      if (data.purchasePrice !== undefined) { unitConfig.purchasePrice = data.purchasePrice; }
    });
  }

}
