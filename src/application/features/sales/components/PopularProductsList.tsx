import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
} from "react-native";
import { Text, useTheme, Button, Divider, Badge } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { CurrencyText } from "@shared/components/CurrencyText";
import { EmptyState } from "@shared/components/EmptyState";
import { database } from "src/database";
import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";
import { Q } from "@nozbe/watermelondb";
import { UnitName } from "@shared/components/UnitName";
import { usePopularProducts } from "../hooks/usePopularProducts";
import { inventoryRepository } from "../../inventory/repositories/inventoryRepository";

interface ProductWithDetails {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  minStock: number;
  isActive: boolean;
  units: ProductUnit[];
  stock: number;
  defaultUnit?: ProductUnit;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

interface SelectedItem {
  product: ProductWithDetails;
  productUnitId: string;
  quantity: number;
}

interface PopularProductsListProps {
  onAddProducts: (items: SelectedItem[]) => void;
  cartProductIds: string[];
}

const POPULAR_LIMIT = 20;

export const PopularProductsList: React.FC<PopularProductsListProps> = ({
  onAddProducts,
  cartProductIds,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const { popularProductIds } = usePopularProducts(POPULAR_LIMIT);
  const [popularProducts, setPopularProducts] = useState<ProductWithDetails[]>(
    [],
  );
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchProductsWithDetails = useCallback(
    async (productIds?: string[]): Promise<ProductWithDetails[]> => {
      const productsCollection = database.get<Product>("products");
      const unitsCollection = database.get<ProductUnit>("product_units");

      let query = productsCollection.query(Q.where("is_active", true));

      if (productIds && productIds.length > 0) {
        query = query.extend(Q.where("id", Q.oneOf(productIds)));
      }

      const products = await query.fetch();

      const productsWithDetails = await Promise.all(
        products.map(
          async (product: {
            id: string;
            name: any;
            sku: any;
            categoryId: any;
            minStock: any;
            isActive: any;
          }) => {
            const units = await unitsCollection
              .query(Q.where("product_id", product.id))
              .fetch();

            const stock = await inventoryRepository.getProductStock(product.id);
            const defaultUnit = units[0] || undefined;

            const raw = (product as any)._raw || {};
            return {
              id: product.id,
              name: raw.name ?? product.name ?? "",
              sku: raw.sku ?? product.sku ?? null,
              categoryId: raw.category_id ?? product.categoryId ?? null,
              minStock: raw.min_stock ?? product.minStock ?? 0,
              isActive: raw.is_active ?? product.isActive ?? true,
              units,
              stock,
              defaultUnit,
              isLowStock:
                stock > 0 && stock <= (raw.min_stock ?? product.minStock ?? 0),
              isOutOfStock: stock <= 0,
            };
          },
        ),
      );

      return productsWithDetails;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPopularProducts = async () => {
      try {
        console.log("[PopularProducts] Loading started...");
        const allProducts = await fetchProductsWithDetails();

        if (cancelled) return;

        const popularSet = new Set(popularProductIds);
        const popularList: ProductWithDetails[] = [];
        const remainingList: ProductWithDetails[] = [];

        for (const product of allProducts) {
          if (popularSet.has(product.id)) {
            popularList.push(product);
          } else {
            remainingList.push(product);
          }
        }

        const sortedPopular = popularProductIds
          .map((id) => allProducts.find((p) => p.id === id))
          .filter((p): p is ProductWithDetails => !!p);

        const sortedRemaining = remainingList.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );

        const result = [...sortedPopular, ...sortedRemaining].slice(
          0,
          POPULAR_LIMIT,
        );

        if (!cancelled) {
          setPopularProducts(result);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[PopularProducts] Failed to load:", error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPopularProducts();

    return () => {
      cancelled = true;
    };
  }, [fetchProductsWithDetails, popularProductIds]);

  const toggleProduct = useCallback((product: ProductWithDetails) => {
    if (product.isOutOfStock) return;

    setSelectedItems((prev) => {
      const next = new Map<string, SelectedItem>(prev);
      const key = product.id;

      if (next.has(key)) {
        next.delete(key);
      } else {
        if (!product.defaultUnit) return prev;
        next.set(key, {
          product,
          productUnitId: product.defaultUnit.id,
          quantity: 1,
        });
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setSelectedItems((prev) => {
      const next = new Map<string, SelectedItem>(prev);
      const item = next.get(productId);
      if (!item) return prev;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        next.delete(productId);
      } else if (newQty <= item.product.stock) {
        next.set(productId, { ...item, quantity: newQty });
      }
      return next;
    });
  }, []);

  const handleAddAll = useCallback(() => {
    const items = [...selectedItems.values()];
    if (items.length > 0) {
      onAddProducts(items);
      setSelectedItems(new Map());
    }
  }, [selectedItems, onAddProducts]);

  const totalSelectedCount = [...selectedItems.values()].reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const renderProduct = useCallback(
    ({ item }: { item: ProductWithDetails }) => {
      const inCart = cartProductIds.includes(item.id);
      const selected = selectedItems.get(item.id);
      const isSelected = !!selected;
      const price = item.defaultUnit?.salePrice || 0;
      const unitId = item.defaultUnit?.unitId;

      return (
        <TouchableOpacity
          style={[
            styles.productRow,
            {
              backgroundColor: isSelected
                ? theme.colors.primaryContainer
                : inCart
                ? theme.colors.secondaryContainer
                : theme.colors.surface,
            },
          ]}
          onPress={() => !item.isOutOfStock && !inCart && toggleProduct(item)}
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
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.error }}
                >
                  {t("outOfStock")}
                </Text>
              ) : (
                <Text
                  variant="labelSmall"
                  style={{
                    color: item.isLowStock
                      ? theme.colors.error
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {item.stock} <UnitName unitId={unitId} fallback={t("unit")} />
                </Text>
              )}
            </View>
          </View>

          <View style={styles.actionSection}>
            {inCart ? (
              <AppIcon name="check" size={18} color={theme.colors.primary} />
            ) : item.isOutOfStock ? null : isSelected ? (
              <View style={styles.qtyControl}>
                <Pressable
                  onPress={() => updateQuantity(item.id, -1)}
                  hitSlop={8}
                  style={[
                    styles.qtyButton,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <AppIcon
                    name="minus"
                    size={16}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
                <Text
                  variant="titleSmall"
                  style={[styles.qtyText, { color: theme.colors.primary }]}
                >
                  {selected?.quantity || 0}
                </Text>
                <Pressable
                  onPress={() => updateQuantity(item.id, 1)}
                  hitSlop={8}
                  style={[
                    styles.qtyButton,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <AppIcon name="plus" size={16} color={theme.colors.primary} />
                </Pressable>
              </View>
            ) : (
              <AppIcon
                name="plus"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [cartProductIds, selectedItems, theme, t, toggleProduct, updateQuantity],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("common:loading")}
        </Text>
      </View>
    );
  }

  if (popularProducts.length === 0) {
    return (
      <EmptyState
        icon="package-variant"
        title={t("noProducts")}
        subtitle={t("noProductsSubtitle")}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          variant="titleSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("popularProducts")}
        </Text>
        {selectedItems.size > 0 && (
          <Badge style={{ backgroundColor: theme.colors.primary }}>
            {selectedItems.size}
          </Badge>
        )}
      </View>

      <Divider />

      <View style={styles.listContainer}>
        <FlatList<ProductWithDetails>
          data={popularProducts}
          renderItem={renderProduct}
          keyExtractor={(item: ProductWithDetails) => item.id}
          extraData={[Array.from(selectedItems.keys()), cartProductIds]}
          ItemSeparatorComponent={() => <Divider />}
        />
      </View>

      {selectedItems.size > 0 && (
        <View
          style={[
            styles.addBar,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}
          >
            {t("selectedCount", { count: totalSelectedCount })}
          </Text>
          <Button
            mode="contained"
            onPress={handleAddAll}
            icon={paperIcon("cart-outline")}
            compact
          >
            {t("addToCart")}
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
    gap: 4,
  },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionSection: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "700",
  },
  addBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
