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
import { UnitName } from "@shared/components/UnitName";
import { paperIcon } from "@shared/components/Icon";
import { useDebounce } from "@shared/hooks/useDebounce";
import { database } from "src/database";
import Product from "src/database/models/Product";
import ProductUnit from "src/database/models/ProductUnit";

import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository";

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
}

interface ProductSearchBarProps {
  // ✅ تم تصحيح النوع ليكون ProductWithDetails بدلاً من Product
  onSelectProduct: (product: ProductWithDetails, unitId?: string) => void;
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

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    let isMounted = true; // ✅ لمنع Race Condition

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

    const subscription = queryBuilder
      .observe()
      .subscribe(async (products: any[]) => {
        const productsWithDetails = await Promise.all(
          products.map(async (product) => {
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
            };
          }),
        );

        if (isMounted) {
          setResults(productsWithDetails);
          setShowResults(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
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
    onSelectProduct(product, product.defaultUnit?.id);
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  // ✅ استخدام دالة العرض بدلاً من تكرار الكود
  const renderResultItem = (product: ProductWithDetails, index: number) => {
    const isOutOfStock = product.stock <= 0;
    const unitId = product.defaultUnit?.unitId;
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
              {t("stock")}: {product.stock}{" "}
              <UnitName unitId={unitId} fallback={t("unit")} />
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
        {index < results.length - 1 && <Divider />}
      </View>
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
          {results.map((product, index) => renderResultItem(product, index))}
        </View>
      )}

      {showResults &&
        results.length === 0 &&
        query.length >= 2 &&
        !isLoading && (
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
