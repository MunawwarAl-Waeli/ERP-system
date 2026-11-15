import React, { useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { useTheme, Button, Switch, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppHeader } from "@shared/components/AppHeader";
import { FormField } from "@shared/components/FormField";
import { customerSchema, CustomerFormData } from "../schemas/customerSchema";
import { customerRepository } from "../repositories/customerRepository";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

export const CustomerFormScreen: React.FC<{
  navigation: NavigationProp;
  route: { params?: { customerId?: string } };
}> = ({ navigation, route }) => {
  const theme = useTheme();
  const { t } = useTranslation("customers");
  const customerId = route.params?.customerId;
  const isEditing = !!customerId;

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
    if (isEditing) {
      customerRepository.getById(customerId).then((customer) => {
        reset({
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          notes: customer.notes,
          isActive: customer.isActive ?? true,
        });
      });
    }
  }, [customerId, isEditing, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (isEditing) {
        await customerRepository.update(customerId, data);
      } else {
        await customerRepository.create(data);
      }
      navigation.goBack();
    } catch {
      Alert.alert(t("common:error"), t("saveError"));
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={isEditing ? t("editCustomer") : t("addCustomer")}
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <FormField
            control={control}
            name="name"
            label={t("common:name")}
            error={errors.name?.message}
            autoFocus={!isEditing}
          />

          <FormField
            control={control}
            name="phone"
            label={t("common:phone")}
            error={errors.phone?.message}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <FormField
            control={control}
            name="address"
            label={t("common:address")}
            error={errors.address?.message}
            multiline
            numberOfLines={3}
          />

          <FormField
            control={control}
            name="notes"
            label={t("common:notes")}
            error={errors.notes?.message}
            multiline
            numberOfLines={3}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
              paddingHorizontal: 4,
            }}
          >
            <Text variant="bodyLarge">{t("common:active", "Active")}</Text>
            <Switch
              value={watch("isActive")}
              onValueChange={(val) => setValue("isActive", val)}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitButton}
          >
            {isEditing ? t("common:update") : t("common:save")}
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
    gap: 16,
  },
  submitButton: {
    marginTop: 8,
  },
});
