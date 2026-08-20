/* eslint-disable prefer-template */
/* eslint-disable complexity */
/* eslint-disable arrow-body-style */
/* eslint-disable no-nested-ternary */
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import {
  Modal,
  Portal,
  Text,
  Button,
  useTheme,
  Menu,
  Divider,
  Switch,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountType } from "@core/database/models/ChartOfAccount";
import { AccountFormData, accountSchema } from "../schema/accountingSchema";
import { AppIcon, paperIcon } from "@shared/components/Icon";
import { Colors } from "@core/theme/colors";

interface AccountFormModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (data: AccountFormData) => void;
  initialData?: AccountFormData | null;
  parentAccounts?: Array<{ label: string; value: string }>;
}

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  visible,
  onDismiss,
  onSave,
  initialData,
  parentAccounts = [],
}) => {
  const theme = useTheme();
  const { t } = useTranslation("accounting");

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "asset",
      parentId: null,
      isCashAccount: false,
    },
  });

  const parentId = watch("parentId");
  const isSubAccount = parentId !== null && parentId !== undefined;
  const isCashAccount = watch("isCashAccount");
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    } else {
      reset({
        code: "",
        name: "",
        type: "asset",
        parentId: null,
        isCashAccount: false,
      });
    }
  }, [initialData, reset, visible]);

  const onFormSubmit = (data: AccountFormData) => {
    onSave(data);
    onDismiss();
  };

  const selectedParentLabel =
    parentAccounts.find((item) => item.value === watch("parentId"))?.label ||
    t("selectParentAccount");

  const typeOptions: Array<{
    value: AccountType;
    label: string;
    icon: string;
  }> = [
    { value: "asset", label: t("assets"), icon: "wallet-outline" },
    {
      value: "liability",
      label: t("liabilities"),
      icon: "credit-card-outline",
    },
    { value: "equity", label: t("equity"), icon: "scale-balance" },
    { value: "revenue", label: t("revenue"), icon: "trending-up" },
    { value: "expense", label: t("expense"), icon: "trending-down" },
  ];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoiding}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            {initialData?.id ? t("editAccount") : t("addAccount")}
          </Text>

          <ScrollView
            contentContainerStyle={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* رمز الحساب واسم الحساب */}

            {/* حقل الكود */}
            <Controller
              control={control}
              name="code"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.container}>
                  <Text style={styles.label}>{t("accountCode")}</Text>
                  <TextInput
                    style={[styles.input, errors.code && styles.errorInput]}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    keyboardType="numeric"
                    maxLength={20}
                    placeholder={t("accountCode")}
                  />
                  {errors.code && (
                    <Text style={styles.errorText}>{errors.code.message}</Text>
                  )}
                </View>
              )}
            />
            {/* حقل الاسم */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.container}>
                  <Text style={styles.label}>{t("accountName")}</Text>
                  <TextInput
                    style={[styles.input, errors.name && styles.errorInput]}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    placeholder={t("accountName")}
                  />
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name.message}</Text>
                  )}
                </View>
              )}
            />
            {/* اختيار نوع الحساب - شبكة متناسقة */}
            <View style={styles.inputGroup}>
              <Text
                variant="labelMedium"
                style={[styles.label, { color: theme.colors.onSurfaceVariant }]}
              >
                {t("accountType")}
              </Text>
              <Controller
                control={control}
                name="type"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.typeGrid}>
                    {typeOptions.map((opt) => {
                      const isSelected = value === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          activeOpacity={0.7}
                          onPress={() => onChange(opt.value)}
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor: isSelected
                                ? theme.colors.primaryContainer
                                : theme.colors.surfaceVariant ||
                                  "rgba(255,255,255,0.05)",
                              borderColor: isSelected
                                ? theme.colors.primary
                                : "transparent",
                            },
                          ]}
                        >
                          <AppIcon
                            name={opt.icon}
                            size={16}
                            color={
                              isSelected
                                ? theme.colors.primary
                                : theme.colors.onSurfaceVariant
                            }
                          />
                          <Text
                            style={[
                              styles.typeChipText,
                              {
                                color: isSelected
                                  ? theme.colors.primary
                                  : theme.colors.onSurfaceVariant,
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              />
            </View>
            {/* بطاقات الخيارات */}
            <View style={styles.optionSection}>
              {/* بطاقة: حساب فرعي */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSubAccount
                      ? theme.colors.primaryContainer + "22"
                      : theme.colors.surfaceVariant + "33",
                    borderColor: isSubAccount
                      ? theme.colors.primary
                      : theme.colors.outlineVariant || "rgba(255,255,255,0.1)",
                  },
                ]}
                onPress={() => setValue("parentId", isSubAccount ? null : "")}
              >
                <View style={styles.optionCardLeft}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: isSubAccount
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant ||
                            "rgba(255,255,255,0.08)",
                      },
                    ]}
                  >
                    <AppIcon
                      name="sitemap"
                      size={18}
                      color={
                        isSubAccount
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {t("subAccount")}
                  </Text>
                </View>
                <Switch
                  value={isSubAccount}
                  onValueChange={() =>
                    setValue("parentId", isSubAccount ? null : "")
                  }
                  color={theme.colors.primary}
                />
              </TouchableOpacity>

              {/* القائمة المنسدلة للحساب الأب */}
              {isSubAccount && (
                <View style={styles.parentContainer}>
                  <Text
                    variant="labelMedium"
                    style={[
                      styles.label,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {t("parentAccount")}
                  </Text>
                  <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setMenuVisible(true)}
                        style={[
                          styles.dropdownAnchor,
                          {
                            borderColor:
                              theme.colors.outlineVariant ||
                              "rgba(255,255,255,0.15)",
                            backgroundColor: theme.colors.surface,
                          },
                        ]}
                      >
                        <View style={styles.dropdownContent}>
                          <AppIcon
                            name="folder"
                            size={18}
                            color={theme.colors.onSurfaceVariant}
                          />
                          <Text style={{ color: theme.colors.onSurface }}>
                            {selectedParentLabel}
                          </Text>
                        </View>
                        <AppIcon
                          name="chevron-down"
                          size={18}
                          color={theme.colors.onSurfaceVariant}
                        />
                      </TouchableOpacity>
                    }
                  >
                    {parentAccounts.map((item) => (
                      <Menu.Item
                        key={item.value}
                        onPress={() => {
                          setValue("parentId", item.value);
                          setMenuVisible(false);
                        }}
                        title={item.label}
                      />
                    ))}
                  </Menu>
                </View>
              )}

              {/* بطاقة: حساب نقدي */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isCashAccount
                      ? theme.colors.primaryContainer + "22"
                      : theme.colors.surfaceVariant + "33",
                    borderColor: isCashAccount
                      ? theme.colors.primary
                      : theme.colors.outlineVariant || "rgba(255,255,255,0.1)",
                  },
                ]}
                onPress={() => setValue("isCashAccount", !isCashAccount)}
              >
                <View style={styles.optionCardLeft}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: isCashAccount
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant ||
                            "rgba(255,255,255,0.08)",
                      },
                    ]}
                  >
                    <AppIcon
                      name="cash"
                      size={18}
                      color={
                        isCashAccount
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {t("isCashAccount")}
                  </Text>
                </View>
                <Switch
                  value={isCashAccount}
                  onValueChange={(val) => setValue("isCashAccount", val)}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <Divider style={styles.divider} />

          {/* أزرار التحكم مصفوفة ومتساوية الإبعاد */}
          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleSubmit(onFormSubmit)}
              icon={paperIcon("check")}
              style={styles.actionButton}
              contentStyle={styles.buttonContent}
            >
              {t("saveAccount")}
            </Button>
            <Button
              mode="outlined"
              onPress={onDismiss}
              textColor={theme.colors.onSurfaceVariant}
              style={[
                styles.actionButton,
                {
                  borderColor:
                    theme.colors.outlineVariant || "rgba(255,255,255,0.15)",
                },
              ]}
              contentStyle={styles.buttonContent}
            >
              {t("common:cancel")}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  // ⬇️ أضف هذه الأنماط الجديدة:
  container: {
    marginBottom: 4, // مسافة بين الحقول
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.onSurface, // استخدم لون النص من الثيم الخاص بك
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border, // لون الحدود من الثيم
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.onSurface,
  },
  errorInput: {
    borderColor: Colors.error, // أحمر عند الخطأ
    borderWidth: 1.5,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },

  modalContent: {
    margin: 16,
    padding: 20,
    borderRadius: 24,
    maxHeight: "90%",
  },
  keyboardAvoiding: {
    flexShrink: 1,
  },
  title: {
    marginBottom: 16,
    fontWeight: "700",
  },
  form: {
    gap: 16,
    paddingBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },

  /* شبكة اختيار نوع الحساب المتوازنة */
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    flexGrow: 1,
    minWidth: "28%",
  },
  typeChipText: {
    fontSize: 13,
  },
  /* بطاقات الخيارات */
  optionSection: {
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
    // textAlign: "right",
  },
  parentContainer: {
    marginTop: 2,
    gap: 6,
  },
  dropdownAnchor: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  divider: {
    marginVertical: 14,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  buttonContent: {
    height: 44,
  },
});
