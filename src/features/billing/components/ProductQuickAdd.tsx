// components/ProductQuickAdd.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme, Chip, Divider } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import { AppIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";
import Category from "@core/database/models/Category";
import { productRepository } from "@features/products/repositories/productRepository";
import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

// نوع ممتد يشمل الوحدات والرصيد
interface ProductWithDetails extends Product {
  units: ProductUnit[];
  stock: number;
  defaultUnit?: ProductUnit;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

interface ProductQuickAddProps {
  onAddProduct: (product: Product, unitId?: string) => void; // ✅ إضافة unitId
  cartProductIds: string[];
}

export const ProductQuickAdd: React.FC<ProductQuickAddProps> = ({
  onAddProduct,
  cartProductIds,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const { t: tProducts } = useTranslation("products");
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >();

  // ========== جلب التصنيفات ==========
  useEffect(() => {
    const sub = productRepository.observeCategories().subscribe(setCategories);
    return () => sub.unsubscribe();
  }, []);

  // ========== جلب المنتجات مع الوحدات والرصيد ==========
  useEffect(() => {
    const productsCollection = database.get<Product>("products");
    const unitsCollection = database.get<ProductUnit>("product_units");

    let query = productsCollection.query(
      Q.where("is_active", true),
      Q.sortBy("name", Q.asc),
    );

    if (selectedCategoryId) {
      query = query.extend(Q.where("category_id", selectedCategoryId));
    }

    const subscription = query.observe().subscribe(async (productList) => {
      // جلب الوحدات والرصيد لكل منتج
      const productsWithDetails = await Promise.all(
        productList.map(async (product) => {
          const units = await unitsCollection
            .query(Q.where("product_id", product.id))
            .fetch();

          const stock = await inventoryRepository.getProductStock(product.id);
          const defaultUnit = units[0] || undefined;

          return {
            ...product,
            units,
            stock,
            defaultUnit,
            isLowStock: stock > 0 && stock <= product.minStock,
            isOutOfStock: stock <= 0,
          };
        }),
      );

      setProducts(productsWithDetails);
    });

    return () => subscription.unsubscribe();
  }, [selectedCategoryId]);

  // ========== عرض المنتج ==========
  const renderProduct = ({ item }: { item: ProductWithDetails }) => {
    const inCart = cartProductIds.includes(item.id);
    const price = item.defaultUnit?.salePrice || 0;
    const unitName = item.defaultUnit?.unit?.name || t("unit");

    return (
      <TouchableOpacity
        style={[
          styles.productRow,
          {
            backgroundColor: inCart
              ? theme.colors.secondaryContainer
              : theme.colors.surface,
          },
        ]}
        onPress={() => {
          if (!item.isOutOfStock && !inCart) {
            // تمرير المنتج مع الوحدة الافتراضية
            onAddProduct(item, item.defaultUnit?.id);
          }
        }}
        disabled={item.isOutOfStock || inCart}
        activeOpacity={0.6}
      >
        <View style={styles.productInfo}>
          <Text
            variant="bodyLarge"
            numberOfLines={1}
            style={{
              color: item.isOutOfStock
                ? theme.colors.onSurfaceVariant
                : theme.colors.onSurface,
            }}
          >
            {item.name}
          </Text>
          <View style={styles.productMeta}>
            <CurrencyText amount={price} variant="bodySmall" />
            {item.isOutOfStock ? (
              <StatusBadge label={t("outOfStock")} variant="error" />
            ) : item.isLowStock ? (
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                {item.stock} {unitName}
              </Text>
            ) : (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {item.stock} {unitName}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.addSection}>
          {inCart ? (
            <AppIcon name="check" size={20} color={theme.colors.primary} />
          ) : !item.isOutOfStock ? (
            <AppIcon name="plus" size={20} color={theme.colors.primary} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          variant="titleSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("tapToAdd")}
        </Text>
      </View>

      {categories.length > 0 && (
        <View style={styles.chipRow}>
          <Chip
            selected={!selectedCategoryId}
            onPress={() => setSelectedCategoryId(undefined)}
            mode="outlined"
            compact
            style={styles.chip}
          >
            {tProducts("allCategories")}
          </Chip>
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              selected={selectedCategoryId === cat.id}
              onPress={() =>
                setSelectedCategoryId(
                  selectedCategoryId === cat.id ? undefined : cat.id,
                )
              }
              mode="outlined"
              compact
              style={styles.chip}
            >
              {cat.name}
            </Chip>
          ))}
        </View>
      )}

      <Divider />

      <View style={styles.listContainer}>
        <FlashList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          estimatedItemSize={60}
          ItemSeparatorComponent={() => <Divider />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  chip: {
    height: 32,
  },
  listContainer: {
    flex: 1,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addSection: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
