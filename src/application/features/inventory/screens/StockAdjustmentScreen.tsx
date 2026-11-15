import React from "react";
import {
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme, Button, SegmentedButtons, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";
import { FormField } from "@shared/components/FormField";
import {
  stockAdjustmentSchema,
  StockAdjustmentFormData,
} from "../schemas/productSchema";
import { inventoryRepository } from "src/application/features/inventory/repositories/inventoryRepository"; // ØªÙ… Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ù‡Ù†Ø§ Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ø³ØªÙˆØ¯Ø¹ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { STOCK_REASONS } from "@core/constants";
import { useProductDetail } from "../hooks/useProductsDetails";
import { UnitName } from "src/shared/components/UnitName";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const StockAdjustmentScreen: React.FC<{
  navigation: NavigationProp;
  route: { params: { productId: string } };
}> = ({ navigation, route }) => {
  const { productId } = route.params;
  const theme = useTheme();
  const { t } = useTranslation("inventory");
  const { product, stock, defaultUnit, isLoading } =
    useProductDetail(productId);
  const [adjustmentType, setAdjustmentType] = React.useState<"add" | "remove">(
    "add",
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      quantity: 1,
      reason: STOCK_REASONS.PURCHASE,
      notes: "",
    },
  });

  const onSubmit = async (data: StockAdjustmentFormData) => {
    try {
      const quantityChange =
        adjustmentType === "add" ? data.quantity : -data.quantity;

      // Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø¬Ø°Ø±ÙŠ: Ø§Ø³ØªØ®Ø¯Ø§Ù… inventoryRepository Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† productRepository
      await inventoryRepository.adjustStock(productId, quantityChange);

      navigation.goBack();
    } catch (_error) {
      Alert.alert(t("common:error"), t("adjustError"));
    }
  };

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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={t("adjustStock")}
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurface, marginBottom: 8 }}
          >
            {product.name} â€” {t("products:currentStock")}: {stock}{" "}
            <UnitName unitId={defaultUnit?.unitId} fallback="" />
          </Text>

          <SegmentedButtons
            value={adjustmentType}
            onValueChange={(value) =>
              setAdjustmentType(value as "add" | "remove")
            }
            buttons={[
              { value: "add", label: t("addStock"), icon: paperIcon("plus") },
              {
                value: "remove",
                label: t("removeStock"),
                icon: paperIcon("minus"),
              },
            ]}
            style={styles.segmented}
          />

          <FormField
            control={control}
            name="quantity"
            label={t("quantity")}
            error={errors.quantity?.message}
            keyboardType="numeric"
          />

          <FormField
            control={control}
            name="reason"
            label={t("reason")}
            error={errors.reason?.message}
          />

          <FormField
            control={control}
            name="notes"
            label={t("notes")}
            error={errors.notes?.message}
            multiline
            numberOfLines={3}
          />

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitButton}
          >
            {t("adjustStock")}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  segmented: {
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 16,
  },
});
