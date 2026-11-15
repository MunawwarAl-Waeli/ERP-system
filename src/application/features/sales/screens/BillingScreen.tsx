// screens/BillingScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useTheme, Button, TextInput, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";
import { notify } from "@shared/notifications";
import { ProductSearchBar } from "../components/ProductSearchBar";
import { PopularProductsList } from "../components/PopularProductsList";
import { CartItemRow } from "../components/CartItemRow";
import { CartSummary } from "../components/CartSummary";
import { PaymentModeSelector } from "../components/PaymentModeSelector";
import { useBillingStore } from "../store/useBillingStore";
import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository";
import { services } from "src/application/compositionRoot";
import { DOCUMENT_STATUSES, PAYMENT_TYPES } from "@core/constants";

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
    partialPaidAmount,
    setPartialPaidAmount,
  } = useBillingStore();

  // ========== إنشاء الفاتورة (عبر الخدمة) ==========
  const handleCreateBill = async () => {
    if (cartItems.length === 0) {
      notify.warning(t("emptyCartMessage") || "السلة فارغة");
      return;
    }

    if (
      (paymentType === PAYMENT_TYPES.CREDIT ||
        paymentType === PAYMENT_TYPES.PARTIAL) &&
      !selectedCustomerId
    ) {
      notify.warning(
        t("noCustomerForCredit") ||
          "الفاتورة الآجلة أو الجزئية تتطلب اختيار عميل",
      );
      return;
    }

    if (
      paymentType === PAYMENT_TYPES.PARTIAL &&
      (partialPaidAmount <= 0 || partialPaidAmount >= grandTotal)
    ) {
      notify.warning(
        t("partialExceedsTotal") ||
          "المبلغ المدفوع يجب أن يكون بين 0 والإجمالي",
      );
      return;
    }

    const paidAmount =
      paymentType === PAYMENT_TYPES.CASH
        ? grandTotal
        : paymentType === PAYMENT_TYPES.PARTIAL
        ? partialPaidAmount
        : 0;

    setIsLoading(true);
    try {
      // ✅ استخدام الخدمة الرسمية (services) — معمارية نظيفة
      const invoice = await services.salesInvoice.createDraft({
        customerId: selectedCustomerId || undefined,
        invoiceDate: new Date().toISOString().slice(0, 10),
        paymentType,
        paidAmount,
        createdBy: "local-user",
        items: cartItems.map((item) => ({
          productId: item.productId,
          productUnitId: item.productUnitId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      clearCart();
      navigation.navigate("SalesInvoiceDetail", { invoiceId: invoice.id });
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : t("billCreationError") || "فشل إنشاء الفاتورة",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ========== اختيار العميل ==========
  const handleSelectCustomer = () => {
    navigation.navigate("CustomersTab", {
      screen: "CustomerList",
      params: { selectionMode: true },
    });
  };

  // ========== إضافة منتج من شريط البحث (عبر الخدمات) ==========
  const handleSelectProduct = async (
    product: { id: string; name: string },
    productUnitId?: string,
  ) => {
    try {
      const fullProduct = await services.product.getById(product.id);
      if (!fullProduct) {
        notify.error("المنتج غير موجود");
        return;
      }

      const stock = await inventoryRepository.getProductStock(product.id);
      if (stock <= 0) {
        notify.warning(t("outOfStockMessage") || "المنتج غير متوفر");
        return;
      }

      const units = fullProduct.units || [];
      const finalUnit = productUnitId
        ? units.find((u) => u.id === productUnitId)
        : units[0];

      if (!finalUnit) {
        notify.error(t("noUnitFound") || "لا توجد وحدة للمنتج");
        return;
      }

      const unitData = await services.unit.getById(finalUnit.unitId);
      const unitName = unitData?.name || t("unit");

      addToCart({
        productId: product.id,
        productUnitId: finalUnit.id,
        productName: product.name,
        unitName,
        quantity: 1,
        unitPrice: finalUnit.salePrice,
        discount: 0,
      });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "فشل إضافة المنتج");
    }
  };

  // ========== إضافة منتجات من الرائجة ==========
  const handleAddPopularProducts = async (
    items: Array<{
      product: { id: string; name: string };
      productUnitId: string;
      quantity: number;
    }>,
  ) => {
    for (const { product, productUnitId, quantity } of items) {
      try {
        const fullProduct = await services.product.getById(product.id);
        const units = fullProduct?.units || [];
        const unit = units.find((u) => u.id === productUnitId);

        const unitData = unit ? await services.unit.getById(unit.unitId) : null;
        const unitName = unitData?.name || t("unit");

        addToCart({
          productId: product.id,
          productUnitId,
          productName: product.name,
          unitName,
          quantity,
          unitPrice: unit?.salePrice || 0,
          discount: 0,
        });
      } catch {
        // المنتج محذوف — تجاهل
      }
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
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

      <ProductSearchBar onSelectProduct={handleSelectProduct} />

      {cartItems.length === 0 ? (
        <PopularProductsList
          onAddProducts={handleAddPopularProducts}
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
            showCredit={true}
          />

          {paymentType === PAYMENT_TYPES.PARTIAL && (
            <View style={styles.partialField}>
              <TextInput
                label={t("partialPaidAmount") || "المبلغ المدفوع الآن"}
                value={partialPaidAmount ? partialPaidAmount.toString() : ""}
                onChangeText={(text) =>
                  setPartialPaidAmount(parseFloat(text) || 0)
                }
                keyboardType="numeric"
                mode="outlined"
                style={styles.partialInput}
                right={<TextInput.Affix text="ر.ي" />}
              />
              {partialPaidAmount > grandTotal && (
                <Text style={styles.errorText}>
                  {t("partialExceedsTotal") ||
                    "المبلغ المدفوع يجب أن يكون بين 0 والإجمالي"}
                </Text>
              )}
            </View>
          )}

          <View style={styles.serviceFeeContainer}>
            <TextInput
              label={t("serviceFee") || "أجور الخدمات"}
              value={serviceFee ? serviceFee.toString() : ""}
              onChangeText={(text) => setServiceFee(parseFloat(text) || 0)}
              keyboardType="numeric"
              mode="outlined"
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
              {selectedCustomerId
                ? t("changeCustomer") || "تغيير العميل"
                : t("selectCustomer") || "اختر العميل"}
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateBill}
              icon={paperIcon("check")}
              style={styles.createButton}
              loading={isLoading}
              disabled={isLoading}
            >
              {t("createBill") || "إنشاء الفاتورة"}
            </Button>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  cartSection: { flex: 1 },
  bottomSection: {
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  partialField: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  partialInput: {
    backgroundColor: "transparent",
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    marginTop: 4,
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
  customerButton: { flex: 1 },
  createButton: { flex: 1 },
});
