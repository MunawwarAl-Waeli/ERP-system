import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  Text,
  useTheme,
  Card,
  Button,
  Divider,
  Portal,
  Dialog,
  TextInput,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { CurrencyText } from "@shared/components/CurrencyText";
import { StatusBadge } from "@shared/components/StatusBadge";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { ConfirmDialog } from "@shared/components/ConfirmDialog";
import { AppIcon, paperIcon } from "@shared/components/Icon";

import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository";
import { useProductDetail } from "../hooks/useProductsDetails";
import { notify } from "@shared/notifications";
import { services } from "src/application/compositionRoot";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const ProductDetailScreen: React.FC<{
  navigation: NavigationProp;
  route: { params: { productId: string } };
}> = ({ navigation, route }) => {
  const { productId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("products");
  const {
    product,
    stock,
    defaultUnit,
    defaultUnitName,
    batches,
    recentMovements,
    isLoading,
  } = useProductDetail(productId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState("");

  // ========== Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø­Ø°Ù (ØªØ¹Ø·ÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬) ==========
  const handleDelete = async () => {
    try {
      await services.product.deactivate(productId);
      setShowDeleteDialog(false);
      navigation.goBack();
    } catch (_error) {
      notify.error(t("common:operationFailed"));
    }
  };

  // ========== Ù…Ø¹Ø§Ù„Ø¬Ø© ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ==========
  const handleAdjustStock = async (quantity: number) => {
    try {
      await inventoryRepository.adjustStock(productId, quantity);
      setShowAdjustDialog(false);
      setAdjustQuantity("");
      notify.success(t("inventory:adjustmentSuccess"));
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : t("common:operationFailed"),
      );
    }
  };

  // ========== Ø­Ø§Ù„Ø© Ø§Ù„ØªØ­Ù…ÙŠÙ„ ==========
  if (isLoading || !product) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <LoadingOverlay visible />
      </SafeAreaView>
    );
  }

  // ========== Ø­Ø³Ø§Ø¨ Ù‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­ ==========
  const purchasePrice = product.lastPurchaseCost || 0;
  const sellingPrice = defaultUnit?.salePrice || 0;
  const profitMargin =
    purchasePrice > 0
      ? (((sellingPrice - purchasePrice) / purchasePrice) * 100).toFixed(1)
      : "0";

  // ========== Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ==========
  const isOutOfStock = stock <= 0;
  const isLowStock = stock <= product.minStock && stock > 0;

  const getStockLabel = () => {
    if (isOutOfStock) {
      return t("inventory:outOfStock");
    }
    if (isLowStock) {
      return t("inventory:lowStock");
    }
    return t("inventory:inStock");
  };

  const getStockVariant = (): "error" | "warning" | "success" => {
    if (isOutOfStock) {
      return "error";
    }
    if (isLowStock) {
      return "warning";
    }
    return "success";
  };

  // ========== Ø¹Ø±Ø¶ Ø§Ù„Ø¯ÙØ¹Ø§Øª ==========
  const renderBatches = () => {
    if (batches.length === 0) {
      return (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("inventory:noBatches")}
        </Text>
      );
    }

    return batches.map((batch) => (
      <View key={batch.id} style={styles.batchItem}>
        <View style={styles.batchRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            {new Date(batch.createdAt).toLocaleDateString()}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            {batch.quantityRemaining} {defaultUnitName || t("unit")}
          </Text>
        </View>
        <View style={styles.batchRow}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("inventory:unitCost")}: <CurrencyText amount={batch.unitCost} />
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("inventory:received")}: {batch.quantityReceived}
          </Text>
        </View>
        <Divider style={styles.batchDivider} />
      </View>
    ));
  };

  // ========== Ø¹Ø±Ø¶ Ø¢Ø®Ø± Ø§Ù„Ø­Ø±ÙƒØ§Øª ==========
  const renderRecentMovements = () => {
    if (recentMovements.length === 0) {
      return (
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("inventory:noMovements")}
        </Text>
      );
    }

    return recentMovements.map((movement) => (
      <View key={movement.id} style={styles.movementItem}>
        <View style={styles.movementRow}>
          <View style={styles.movementType}>
            <AppIcon
              name={movement.quantity > 0 ? "arrow-up" : "arrow-down"}
              size={16}
              color={movement.quantity > 0 ? "#388E3C" : theme.colors.error}
            />
            <Text variant="bodyMedium">
              {t(`inventory:movementTypes.${movement.movementType}`)}
            </Text>
          </View>
          <Text
            variant="bodyMedium"
            style={{
              color: movement.quantity > 0 ? "#388E3C" : theme.colors.error,
              fontWeight: "600",
            }}
          >
            {movement.quantity > 0 ? "+" : ""}
            {movement.quantity}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {new Date(movement.movementDate).toLocaleString()}
        </Text>
        <Divider style={styles.movementDivider} />
      </View>
    ));
  };

  // ========== Ø§Ù„ØªØµÙ…ÙŠÙ… ==========
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={product.name}
        showBack
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: "pencil",
            onPress: () => navigation.navigate("ProductForm", { productId }),
          },
          {
            icon: "delete",
            onPress: () => setShowDeleteDialog(true),
          },
        ]}
      />
      <ScrollView style={styles.scrollView}>
        {/* ===== Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„ØªØ³Ø¹ÙŠØ± ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("pricing")}
            </Text>
            <View style={styles.priceRow}>
              <View style={styles.priceItem}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("purchasePrice")}
                </Text>
                <CurrencyText amount={purchasePrice} variant="titleLarge" />
              </View>
              <View style={styles.priceItem}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("sellingPrice")}
                </Text>
                <CurrencyText amount={sellingPrice} variant="titleLarge" />
              </View>
              <View style={styles.priceItem}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("profitMargin")}
                </Text>
                <Text
                  variant="titleLarge"
                  style={{ color: theme.colors.primary }}
                >
                  {profitMargin}%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* ===== Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.stockHeader}>
              <Text variant="titleMedium">{t("currentStock")}</Text>
              <StatusBadge
                label={getStockLabel()}
                variant={getStockVariant()}
              />
            </View>

            <View style={styles.stockInfo}>
              <View style={styles.stockItem}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("currentStock")}
                </Text>
                <Text variant="headlineMedium">
                  {stock} {defaultUnitName || t("unit")}
                </Text>
              </View>
              <View style={styles.stockItem}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("lowStockThreshold")}
                </Text>
                <Text variant="headlineMedium">
                  {product.minStock} {defaultUnitName || t("unit")}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon={paperIcon("plus")}
                onPress={() =>
                  navigation.navigate("MoreTab", {
                    screen: "PurchaseInvoiceForm",
                  })
                }
                style={styles.actionButton}
              >
                {t("inventory:purchase")}
              </Button>
              <Button
                mode="contained"
                icon={paperIcon("minus")}
                onPress={() =>
                  navigation.navigate("BillingTab", { screen: "BillingHome" })
                }
                style={styles.actionButton}
              >
                {t("inventory:sell")}
              </Button>
              <Button
                mode="outlined"
                icon={paperIcon("plus-minus")}
                onPress={() => setShowAdjustDialog(true)}
                style={styles.actionButton}
              >
                {t("inventory:adjust")}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* ===== Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¯ÙØ¹Ø§Øª ===== */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("inventory:batches")}
            </Text>
            {renderBatches()}
          </Card.Content>
        </Card>

        {/* ===== Ø¨Ø·Ø§Ù‚Ø© Ø¢Ø®Ø± Ø§Ù„Ø­Ø±ÙƒØ§Øª ===== */}
        <Card style={[styles.card, styles.lastCard]} mode="elevated">
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t("inventory:recentMovements")}
            </Text>
            {renderRecentMovements()}
          </Card.Content>
        </Card>
      </ScrollView>
      {/* ===== Ø­ÙˆØ§Ø± Ø§Ù„ØªØ£ÙƒÙŠØ¯ ===== */}
      <ConfirmDialog
        visible={showDeleteDialog}
        title={t("deleteProduct")}
        message={t("deleteConfirm")}
        confirmLabel={t("common:delete")}
        onConfirm={handleDelete}
        onDismiss={() => setShowDeleteDialog(false)}
        destructive
      />

      <Portal>
        <Dialog
          visible={showAdjustDialog}
          onDismiss={() => {
            setShowAdjustDialog(false);
            setAdjustQuantity("");
          }}
        >
          <Dialog.Title>{t("inventory:adjustStock")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("inventory:adjustStockMessage")}</Text>
            <TextInput
              label={t("inventory:enterQuantity")}
              value={adjustQuantity}
              onChangeText={setAdjustQuantity}
              keyboardType="numeric"
              mode="outlined"
              style={{ marginTop: 12 }}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setShowAdjustDialog(false);
                setAdjustQuantity("");
              }}
            >
              {t("common:cancel")}
            </Button>
            <Button
              onPress={() => {
                const quantity = parseFloat(adjustQuantity);
                if (isNaN(quantity) || quantity === 0) {
                  notify.warning(t("inventory:invalidQuantity"));
                  return;
                }
                handleAdjustStock(quantity);
              }}
            >
              {t("common:confirm")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

// ========== Ø§Ù„Ø£Ù†Ù…Ø§Ø· ==========
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  card: { margin: 16, marginBottom: 0 },
  lastCard: { marginBottom: 16 },
  sectionTitle: { fontWeight: "700", marginBottom: 12 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceItem: { alignItems: "center", gap: 4 },
  stockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stockInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  stockItem: { alignItems: "center", gap: 4 },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionButton: { flex: 1 },
  batchItem: { marginBottom: 8 },
  batchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  batchDivider: { marginVertical: 6 },
  movementItem: { marginBottom: 8 },
  movementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  movementType: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  movementDivider: { marginVertical: 6 },
});
