import React, { useState, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, FAB, Menu, Divider } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { SearchInput } from "@shared/components/SearchInput";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { ProductCard } from "../components/ProductCard";
import { CategoryFilter } from "../components/CategoryFilter";
import { useCategories, useProductsWithStock } from "../hooks/useProducts";

type SortOption = "name_asc" | "name_desc" | "stock_low" | "stock_high";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const ProductListScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >();
  const [sortBy, setSortBy] = useState<SortOption>("name_asc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const {
    products,
    isLoading: isLoadingProducts,
    error: errorProducts,
  } = useProductsWithStock(searchQuery, selectedCategoryId);

  const {
    categories,
    isLoading: isLoadingCategories,
    error: errorCategory,
  } = useCategories();

  // عدد المنتجات لكل تصنيف (لشريط التصفية)
  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.categoryId) {
        counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // ترتيب المنتجات حسب الخيار المختار
  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    switch (sortBy) {
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "stock_low":
        sorted.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
        break;
      case "stock_high":
        sorted.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
        break;
    }
    return sorted;
  }, [products, sortBy]);

  const getCategoryName = useCallback(
    (categoryId: string) => categories.find((c) => c.id === categoryId)?.name,
    [categories],
  );

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setShowSortMenu(false);
  };

  const renderSortLabel = useCallback(() => {
    const labels: Record<SortOption, string> = {
      name_asc: t("sortNameAZ"),
      name_desc: t("sortNameZA"),
      stock_low: t("sortStockLow"),
      stock_high: t("sortStockHigh"),
    };
    return labels[sortBy];
  }, [sortBy, t]);

  const isLoading = isLoadingProducts && isLoadingCategories;

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (errorCategory || errorProducts) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.error }}>
          {errorProducts?.message || errorCategory?.message}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("title")}
        actions={[
          {
            icon: "package-variant",
            onPress: () => navigation.navigate("InventoryOverview"),
          },
        ]}
      />

      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t("searchProduct")}
      />

      <CategoryFilter
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        productCountByCategory={productCountByCategory}
      />

      <View style={styles.listSection}>
        <View style={styles.sortBar}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {sortedProducts.length} {t("productsCount")}
          </Text>
          <Menu
            visible={showSortMenu}
            onDismiss={() => setShowSortMenu(false)}
            anchor={
              <Pressable
                onPress={() => setShowSortMenu(true)}
                style={styles.sortButton}
              >
                <AppIcon name="sort" size={14} color={theme.colors.primary} />
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.primary, marginLeft: 4 }}
                >
                  {renderSortLabel()}
                </Text>
                <AppIcon
                  name="chevron-down"
                  size={14}
                  color={theme.colors.primary}
                />
              </Pressable>
            }
          >
            <Menu.Item
              onPress={() => handleSort("name_asc")}
              title={t("sortNameAZ")}
            />
            <Menu.Item
              onPress={() => handleSort("name_desc")}
              title={t("sortNameZA")}
            />
            <Divider />
            <Menu.Item
              onPress={() => handleSort("stock_low")}
              title={t("sortStockLow")}
            />
            <Menu.Item
              onPress={() => handleSort("stock_high")}
              title={t("sortStockHigh")}
            />
          </Menu>
        </View>

        {sortedProducts.length === 0 ? (
          <EmptyState
            icon="package-variant"
            title={t("noProducts")}
            subtitle={t("noProductsSubtitle")}
            actionLabel={t("addProduct")}
            onAction={() => navigation.navigate("ProductForm")}
          />
        ) : (
          <View style={styles.listContainer}>
            <FlashList
              data={sortedProducts}
              renderItem={({ item }) => (
                <ProductCard
                  name={item.name}
                  sku={item.sku ?? ""}
                  lastPurchaseCost={item.lastPurchaseCost}
                  stock={item.stock ?? 0}
                  minStock={item.minStock}
                  categoryName={
                    item.categoryId
                      ? getCategoryName(item.categoryId)
                      : undefined
                  }
                  isLowStock={(item.stock ?? 0) <= item.minStock}
                  isOutOfStock={(item.stock ?? 0) <= 0}
                  onPress={() =>
                    navigation.navigate("ProductDetail", {
                      productId: item.id,
                    })
                  }
                />
              )}
              keyExtractor={(item) => item.id}
              // estimatedItemSize={120}
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}
      </View>

      <FAB
        icon={paperIcon("plus")}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate("ProductForm")}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sortBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  listSection: { flex: 1 },
  listContainer: { flex: 1 },
  listContent: { paddingBottom: 80, paddingTop: 4 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    borderRadius: 16,
  },
});
