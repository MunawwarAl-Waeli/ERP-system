// components/ProductSearchBar.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { TextInput, useTheme, Text, Divider } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { paperIcon } from "@shared/components/Icon";
import { useDebounce } from "@shared/hooks/useDebounce";
import { database } from "@core/database";
import Product from "@core/database/models/Product";
import ProductUnit from "@core/database/models/ProductUnit";

import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";

// نوع ممتد يشمل الوحدات والرصيد
interface ProductWithDetails extends Product {
  units: ProductUnit[];
  stock: number;
  defaultUnit?: ProductUnit;
}

interface ProductSearchBarProps {
  onSelectProduct: (product: Product, unitId?: string) => void; // ✅ إضافة unitId
}

export const ProductSearchBar: React.FC<ProductSearchBarProps> = ({
  onSelectProduct,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductWithDetails[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  // ========== البحث عن المنتجات ==========
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    const productsCollection = database.get<Product>("products");
    const unitsCollection = database.get<ProductUnit>("product_units");

    const queryBuilder = productsCollection.query(
      Q.where("is_active", true),
      Q.or(
        Q.where("name", Q.like(`%${Q.sanitizeLikeString(debouncedQuery)}%`)),
        Q.where("sku", Q.like(`%${Q.sanitizeLikeString(debouncedQuery)}%`)),
      ),
      Q.sortBy("name", Q.asc),
      Q.take(10),
    );

    const subscription = queryBuilder.observe().subscribe(async (products) => {
      // جلب الوحدات والرصيد لكل منتج
      const productsWithDetails = await Promise.all(
        products.map(async (product) => {
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
          };
        }),
      );

      setResults(productsWithDetails);
      setShowResults(true);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [debouncedQuery]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleSelect = (product: ProductWithDetails) => {
    // تمرير المنتج مع الوحدة الافتراضية
    onSelectProduct(product, product.defaultUnit?.id);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  // ========== عرض المنتج ==========
  const renderResultItem = (product: ProductWithDetails) => {
    const isOutOfStock = product.stock <= 0;
    const unitName = product.defaultUnit?.unit?.name || t("unit");
    const price = product.defaultUnit?.salePrice || 0;

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelect(product)}
        disabled={isOutOfStock}
      >
        <View style={styles.resultInfo}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            {product.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {product.sku ? `${product.sku} • ` : ""}
            {t("stock")}: {product.stock} {unitName}
            {isOutOfStock && ` • ${t("outOfStock")}`}
          </Text>
        </View>
        <Text
          variant="titleSmall"
          style={{
            color: isOutOfStock ? theme.colors.error : theme.colors.primary,
          }}
        >
          {isOutOfStock ? t("unavailable") : `${price}`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        value={query}
        onChangeText={handleQueryChange}
        placeholder={t("searchProducts")}
        left={<TextInput.Icon icon={paperIcon("magnify")} />}
        right={
          query ? (
            <TextInput.Icon
              icon={paperIcon("close")}
              onPress={() => handleQueryChange("")}
            />
          ) : isLoading ? (
            <ActivityIndicator size="small" />
          ) : undefined
        }
        style={styles.input}
      />

      {showResults && results.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          {results.map((product, index) => {
            const isOutOfStock = product.stock <= 0;
            const unitName = product.defaultUnit?.unit?.name || t("unit");
            const price = product.defaultUnit?.salePrice || 0;

            return (
              <View key={product.id}>
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelect(product)}
                  disabled={isOutOfStock}
                >
                  <View style={styles.resultInfo}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface }}
                    >
                      {product.name}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {product.sku ? `${product.sku} • ` : ""}
                      {t("stock")}: {product.stock} {unitName}
                      {isOutOfStock && ` • ${t("outOfStock")}`}
                    </Text>
                  </View>
                  <Text
                    variant="titleSmall"
                    style={{
                      color: isOutOfStock
                        ? theme.colors.error
                        : theme.colors.primary,
                    }}
                  >
                    {isOutOfStock ? t("unavailable") : `${price}`}
                  </Text>
                </TouchableOpacity>
                {index < results.length - 1 && <Divider />}
              </View>
            );
          })}
        </View>
      )}

      {showResults && results.length === 0 && query.length >= 2 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
            },
          ]}
        >
          <Text style={styles.emptyText}>{t("noProductsFound")}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  input: {
    backgroundColor: "transparent",
  },
  dropdown: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 20,
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
    marginRight: 8,
  },
  emptyText: {
    textAlign: "center",
    padding: 16,
    color: "#999",
  },
});
