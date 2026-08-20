// screens/BillingScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { useTheme, Button, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";
import { ProductSearchBar } from "../components/ProductSearchBar";
import { PopularProductsList } from "../components/PopularProductsList";
import { CartItemRow } from "../components/CartItemRow";
import { CartSummary } from "../components/CartSummary";
import { PaymentModeSelector } from "../components/PaymentModeSelector";
import { database } from "@core/database";
import ProductUnit from "@core/database/models/ProductUnit";
import { useBillingStore } from "../store/useBillingStore";
import { Q } from "@nozbe/watermelondb";
import { inventoryRepository } from "@features/inventory/repositories/inventoryRepository";
import { salesRepository } from "../repositories/salesRepository";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const BillingScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const { t } = useTranslation("billing");
  const [isLoading, setIsLoading] = useState(false);

  const {
    cartItems,
    subtotal,
    discountTotal,
    grandTotal,
    serviceFee,
    paymentType,
    selectedCustomerId,
    addToCart,
    updateQuantity,
    removeFromCart,
    setPaymentType,
    setServiceFee,
    clearCart,
  } = useBillingStore();

  // ========== إنشاء الفاتورة ==========
  const handleCreateBill = async () => {
    if (cartItems.length === 0) {
      Alert.alert(t("emptyCart"), t("emptyCartMessage"));
      return;
    }

    if (paymentType === "credit" && !selectedCustomerId) {
      Alert.alert(t("selectCustomer"), t("noCustomerForCredit"));
      return;
    }

    setIsLoading(true);
    try {
      const invoice = await salesRepository.create({
        customerId: selectedCustomerId || undefined,
        invoiceDate: new Date(),
        paymentType,
        status: "draft", // 👈 إضافة حالة الفاتورة المطلوبة
        paidAmount: paymentType === "cash" ? grandTotal : 0, // 👈 إضافة المبلغ المدفوع المطلوب
        items: cartItems.map((item) => ({
          productId: item.productId,
          productUnitId: item.productUnitId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          itemType: "product",
        })),
        discountTotal: discountTotal ?? 0,
        notes: "",
      });

      clearCart();
      navigation.navigate("SalesInvoiceDetail", { invoiceId: invoice.id });
    } catch (error) {
      Alert.alert(
        t("common:error"),
        error instanceof Error ? error.message : t("billCreationError"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ========== تحديد العملاء ==========
  const handleSelectCustomer = () => {
    navigation.navigate("CustomersTab", {
      screen: "CustomerList",
      params: { selectionMode: true },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      {/* ===== الهيدر ===== */}
      <AppHeader
        title={t("newBill")}
        actions={[
          {
            icon: "history",
            onPress: () => navigation.navigate("SalesInvoiceList"),
          },
          ...(cartItems.length > 0
            ? [{ icon: "trash-2", onPress: clearCart }]
            : []),
        ]}
      />

      {/* ===== شريط البحث ===== */}
      <ProductSearchBar
        onSelectProduct={async (product, unitId) => {
          const stock = await inventoryRepository.getProductStock(product.id);
          if (stock <= 0) {
            Alert.alert(t("outOfStock"), t("outOfStockMessage"));
            return;
          }

          let finalUnitId = unitId;
          if (!finalUnitId) {
            const unitsCollection = database.get<ProductUnit>("product_units");
            const units = await unitsCollection
              .query(
                Q.where("product_id", product.id),
                Q.sortBy("created_at", Q.asc),
              )
              .fetch();
            finalUnitId = units[0]?.id;
            if (!finalUnitId) {
              Alert.alert(t("common:error"), t("noUnitFound"));
              return;
            }
          }

          const unitsCollection = database.get<ProductUnit>("product_units");
          const unit = await unitsCollection.find(finalUnitId);

          addToCart({
            productId: product.id,
            productUnitId: unit.id,
            productName: product.name,
            unitName: unit.unit?.name || t("unit"),
            quantity: 1,
            unitPrice: unit.salePrice,
            discount: 0,
          });
        }}
      />

      {/* ===== قائمة المنتجات أو المنتجات الرائجة ===== */}
      {cartItems.length === 0 ? (
        <PopularProductsList
          onAddProducts={async (items) => {
            for (const { product, productUnitId, quantity } of items) {
              const unitRecord = await database
                .get<ProductUnit>("product_units")
                .find(productUnitId);

              addToCart({
                productId: product.id,
                productUnitId,
                productName: product.name,
                unitName: t("unit"),
                quantity,
                unitPrice: unitRecord?.salePrice || 0, // 👈 جلب السعر من جدول الوحدات
                discount: 0,
              });
            }
          }}
          cartProductIds={cartItems.map((item) => item.productId)}
        />
      ) : (
        <ScrollView style={styles.cartSection}>
          {cartItems.map((item) => (
            <CartItemRow
              key={`${item.productId}-${item.productUnitId}`}
              item={item}
              onUpdateQuantity={(qty) =>
                updateQuantity(item.productId, item.productUnitId, qty)
              }
              onRemove={() =>
                removeFromCart(item.productId, item.productUnitId)
              }
            />
          ))}
        </ScrollView>
      )}

      {/* ===== القسم السفلي ===== */}
      {cartItems.length > 0 && (
        <View
          style={[
            styles.bottomSection,
            { borderTopColor: theme.colors.outlineVariant },
          ]}
        >
          <PaymentModeSelector
            value={paymentType}
            onChange={setPaymentType}
            showCredit={!!selectedCustomerId}
          />

          {/* حقل أجور الخدمات الاختياري */}
          <View style={styles.serviceFeeContainer}>
            <TextInput
              label={t("serviceFee") || "أجور الخدمات"}
              value={serviceFee ? serviceFee.toString() : ""}
              onChangeText={(text) => {
                const numericValue = parseFloat(text) || 0;
                setServiceFee(numericValue);
              }}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={styles.serviceFeeInput}
            />
          </View>

          <CartSummary
            subtotal={subtotal}
            discountTotal={discountTotal}
            grandTotal={grandTotal}
            itemCount={cartItems.length}
          />
          <View style={styles.actionRow}>
            <Button
              mode="outlined"
              onPress={handleSelectCustomer}
              icon={paperIcon("user")}
              style={styles.customerButton}
            >
              {selectedCustomerId ? t("changeCustomer") : t("selectCustomer")}
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateBill}
              icon={paperIcon("check")}
              style={styles.createButton}
              loading={isLoading}
            >
              {t("createBill")}
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cartSection: {
    flex: 1,
  },
  bottomSection: {
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  serviceFeeContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  serviceFeeInput: {
    backgroundColor: "transparent",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  customerButton: {
    flex: 1,
  },
  createButton: {
    flex: 1,
  },
});
