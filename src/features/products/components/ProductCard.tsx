import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Text, useTheme, ProgressBar, Surface } from "react-native-paper";
import { CurrencyText } from "@shared/components/CurrencyText";
// import { AppIcon } from "@shared/components/Icon";
import { useTranslation } from "react-i18next";
// import { CURRENCY_SYMBOL } from "@core/constants";

interface ProductCardProps {
  // بيانات المنتج الأساسية
  name: string;
  sku?: string;
  categoryName?: string;

  // بيانات المخزون
  stock: number;
  minStock: number;
  lastPurchaseCost: number; // آخر تكلفة شراء

  // حالة المنتج
  isLowStock: boolean;
  isOutOfStock: boolean;

  // التفاعل
  onPress: () => void;
  onLongPress?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  name,
  sku,
  categoryName,
  stock,
  minStock,
  lastPurchaseCost,
  isLowStock,
  isOutOfStock,
  onPress,
  onLongPress,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("products");

  // ============================
  // حساب الألوان والحالات
  // ============================
  const getStockColor = (): string => {
    if (isOutOfStock) {
      return theme.colors.error;
    }
    if (isLowStock) {
      return theme.colors.tertiary;
    }
    return theme.colors.primary;
  };

  const getStockBgColor = (): string => {
    if (isOutOfStock) {
      return theme.colors.errorContainer;
    }
    if (isLowStock) {
      return theme.colors.tertiaryContainer;
    }
    return theme.colors.primaryContainer;
  };

  const getStockLabel = (): string => {
    if (isOutOfStock) {
      return t("outOfStock");
    }
    if (isLowStock) {
      return t("lowStock");
    }
    return t("inStock");
  };

  // ============================
  // حساب شريط التقدم
  // ============================
  // نعتمد على الحد الأقصى = max(minStock * 3, stock, 1) لتوزيع جيد
  const maxDisplay = Math.max(minStock * 3, stock, 1);
  const stockProgress = Math.min(stock / maxDisplay, 1);

  const stockColor = getStockColor();
  const stockBgColor = getStockBgColor();

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        {/* الصف العلوي: الاسم + شارة الحالة */}
        <View style={styles.topRow}>
          <View style={styles.nameSection}>
            <Text
              variant="titleMedium"
              style={[styles.name, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {categoryName ? (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                  numberOfLines={1}
                >
                  {categoryName}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.stockBadge, { backgroundColor: stockBgColor }]}>
            <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
            <Text style={[styles.stockBadgeText, { color: stockColor }]}>
              {getStockLabel()}
            </Text>
          </View>
        </View>

        {/* الصف الأوسط: التكلفة / السعر */}
        <View style={styles.priceRow}>
          <View style={styles.priceSection}>
            <CurrencyText amount={lastPurchaseCost} variant="titleMedium" />
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}
            >
              {t("lastCost")}
            </Text>
          </View>

          {sku ? (
            <View
              style={[
                styles.skuBadge,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {sku}
              </Text>
            </View>
          ) : null}
        </View>

        {/* الصف السفلي: شريط المخزون + الكمية */}
        <View style={styles.stockRow}>
          <View style={styles.stockBarSection}>
            <ProgressBar
              progress={stockProgress}
              color={stockColor}
              style={[
                styles.stockBar,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            />
          </View>
          <Text
            variant="labelMedium"
            style={[styles.stockQuantity, { color: stockColor }]}
          >
            {stock} {t("unit")}
          </Text>
        </View>

        {/* معلومات إضافية: الحد الأدنى */}
        <View style={styles.footerRow}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("minStock")}: {minStock}
          </Text>
        </View>
      </Surface>
    </Pressable>
  );
};

// ============================
// الأنماط
// ============================
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  nameSection: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontWeight: "600",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  priceSection: {
    flexDirection: "row",
    alignItems: "baseline",
    flex: 1,
  },
  skuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stockBarSection: {
    flex: 1,
  },
  stockBar: {
    height: 6,
    borderRadius: 3,
  },
  stockQuantity: {
    fontWeight: "600",
    minWidth: 50,
    textAlign: "right",
  },
  footerRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
