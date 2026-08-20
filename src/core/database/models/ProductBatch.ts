// models/ProductBatch.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, immutableRelation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Product from './Product';

export default class ProductBatch extends Model {
  static table = 'product_batches';

  static associations: Associations = {
    products: {
      type: 'belongs_to',
      key: 'product_id',
    },
  };

  @field('product_id') productId!: string;
  @field('purchase_item_id') purchaseItemId?: string;
  @field('quantity_received') quantityReceived!: number;
  @field('quantity_remaining') quantityRemaining!: number;
  @field('unit_cost') unitCost!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @immutableRelation('products', 'product_id')
  product!: Product; // استبدل بـ Product
}