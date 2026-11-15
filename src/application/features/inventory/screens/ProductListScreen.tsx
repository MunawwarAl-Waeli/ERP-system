import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Text, useTheme, Card, Searchbar, FAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { CurrencyText } from "@shared/components/CurrencyText";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";
import { ProductSearchResult } from "@core/types/products/product";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

const ProductItem = ({
  product,
  onPress,
}: {
  product: ProductSearchResult;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Card style={styles.card} onPress={onPress} mode="outlined">
      <Card.Content style={styles.cardContent}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <AppIcon
            name="package-variant"
            size={22}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.infoSection}>
          <Text variant="titleMedium" style={styles.name}>
            {product.name}
          </Text>
          {product.sku ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {product.sku}
            </Text>
          ) : null}
        </View>
        <View style={styles.priceSection}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {product.pieceUnitName}
          </Text>
          <CurrencyText
            amount={product.salePrice}
            variant="titleMedium"
            color={theme.colors.primary}
          />
        </View>
        <AppIcon name="chevron-left" size={20} color={theme.colors.outline} />
      </Card.Content>
    </Card>
  );
};

export const ProductListScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await services.product.search({
        page: 1,
        pageSize: 100,
        search: debouncedSearch.trim() || undefined,
        activeOnly: true,
      });
      setProducts(result.items);
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "فشل تحميل المنتجات",
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts]),
  );

  if (isLoading && products.length === 0) {
    return <LoadingOverlay visible />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="إدارة المنتجات"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="بحث بالاسم أو الـSKU..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          icon={() => (
            <AppIcon
              name="magnify"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          )}
          clearIcon={() => (
            <AppIcon
              name="close"
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ProductItem
            product={item}
            onPress={() =>
              navigation.navigate("ProductDetail", { productId: item.productId })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="package-variant"
            title="لا توجد منتجات"
            subtitle="اضغط على زر الإضافة لإنشاء منتج جديد."
          />
        }
      />

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
  searchContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    elevation: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  searchInput: { textAlign: "right", fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 90 },
  card: { marginBottom: 10, borderRadius: 14 },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  infoSection: { flex: 1, alignItems: "flex-start" },
  name: { fontWeight: "700", textAlign: "right" },
  priceSection: { alignItems: "flex-end" },
  fab: {
    position: "absolute",
    margin: 16,
    left: 0,
    bottom: 0,
    borderRadius: 16,
  },
});
