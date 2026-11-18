import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  PermissionsAndroid,
  Pressable,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { Button, Switch, Text, ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormField } from "@shared/components/FormField";
import { AppIcon } from "src/shared/components/Icon";
import { customerSchema, CustomerFormData } from "../schemas/customerSchema";
import { customerRepository } from "../repositories/customerRepository";
import { notify } from "@shared/notifications";
import { Colors } from "src/core/theme/colors";

interface CustomerFormModalProps {
  visible: boolean;
  onDismiss: () => void;
  customerId?: string;
  onSuccess?: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  visible,
  onDismiss,
  customerId,
  onSuccess,
}) => {
  const { t } = useTranslation("customers");
  const isEditing = !!customerId;
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (visible && isEditing && customerId) {
      setIsLoadingCustomer(true);
      customerRepository
        .getById(customerId)
        .then((customer) => {
          if (customer) {
            reset({
              name: customer.name || "",
              phone: customer.phone || "",
              address: customer.address || "",
              notes: customer.notes || "",
              isActive: customer.isActive ?? true,
            });
          }
        })
        .finally(() => setIsLoadingCustomer(false));
    } else if (visible && !isEditing) {
      reset({
        name: "",
        phone: "",
        address: "",
        notes: "",
        isActive: true,
      });
    }
  }, [visible, customerId, isEditing, reset]);

  const handleImportContact = async () => {
    try {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: "إذن الوصول لجهات الاتصال",
            message: "يحتاج التطبيق لإذن القراءة لاسترداد بيانات العميل مباشرة",
            buttonPositive: "موافق",
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          notify.warning("يلزم السماح بالوصول لجهات الاتصال لاسترداد البيانات");
          return;
        }
      }

      const { selectContactPhone } = require("react-native-select-contact");
      const selection = await selectContactPhone();

      if (selection && selection.contact) {
        const contactName = selection.contact.name || "";
        const rawPhone = selection.selectedPhone?.number || "";
        const cleanPhone = rawPhone.replace(/[^0-9+]/g, "");

        setValue("name", contactName, { shouldValidate: true });
        setValue("phone", cleanPhone, { shouldValidate: true });
        notify.success("تم استرداد بيانات جهة الاتصال بنجاح");
      }
    } catch (error) {
      console.warn("[ContactImport] Failed or cancelled:", error);
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (isEditing && customerId) {
        await customerRepository.update(customerId, data);
        notify.success(t("customerUpdated") || "تم تحديث بيانات العميل بنجاح");
      } else {
        await customerRepository.create(data);
        notify.success(t("customerCreated") || "تمت إضافة العميل بنجاح");
      }
      onDismiss();
      onSuccess?.();
    } catch {
      notify.error(t("saveError") || "فشلت عملية حفظ بيانات العميل");
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.modalCard}>
            {/* الترويسة العليا */}
            <View style={styles.headerRow}>
              <Text style={styles.modalTitle}>
                {isEditing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
              </Text>

              {!isEditing && (
                <Pressable
                  style={styles.importContactBtn}
                  onPress={handleImportContact}
                >
                  <AppIcon name="users" size={14} color={Colors.primary} />
                  <Text style={styles.importContactText}>من جهات الاتصال</Text>
                </Pressable>
              )}
            </View>

            {/* جسم النموذج القابل للتمرير */}
            {isLoadingCustomer ? (
              <ActivityIndicator
                style={{ marginVertical: 30 }}
                color={Colors.primary}
              />
            ) : (
              <ScrollView
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formContainer}
              >
                <FormField
                  control={control}
                  name="name"
                  label={t("common:name") || "اسم العميل"}
                  error={errors.name?.message}
                />

                <FormField
                  control={control}
                  name="phone"
                  label={t("common:phone") || "رقم الهاتف"}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                  maxLength={15}
                />

                <FormField
                  control={control}
                  name="notes"
                  label={t("common:notes") || "ملاحظات (اختياري)"}
                  error={errors.notes?.message}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    {t("common:active") || "تفعيل حساب العميل"}
                  </Text>
                  <Switch
                    value={watch("isActive")}
                    onValueChange={(val) => setValue("isActive", val)}
                    color={Colors.primary}
                  />
                </View>
              </ScrollView>
            )}

            {/* الأزرار السفلى المثبتة دائماً فوق الكيبورد */}
            <View style={styles.actionsRow}>
              <Button
                onPress={onDismiss}
                disabled={isSubmitting}
                textColor={Colors.neutralText}
              >
                إلغاء
              </Button>

              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting || isLoadingCustomer}
                buttonColor={Colors.primary}
                style={styles.submitBtn}
                labelStyle={styles.submitBtnLabel}
              >
                {isEditing ? "تحديث" : "حفظ العميل"}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  keyboardView: {
    width: "100%",
    maxHeight: "85%",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    maxHeight: "100%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.onSurface,
  },
  importContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  importContactText: {
    fontSize: 11,
    fontWeight: "bold",
    color: Colors.primary,
  },
  formContainer: {
    gap: 10,
    paddingBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: Colors.onSurface,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 6,
  },
  submitBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  submitBtnLabel: {
    fontSize: 13,
    fontWeight: "bold",
  },
});
