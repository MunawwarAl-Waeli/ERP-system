import React, { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Menu,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { CurrencyText } from "@shared/components/CurrencyText";
import ReceiptVoucher from "src/database/models/ReceiptVoucher";
import PaymentVoucher from "src/database/models/PaymentVoucher";
import Customer from "src/database/models/Customer";
import Supplier from "src/database/models/Supplier";
import ChartOfAccount from "src/database/models/ChartOfAccount";
import PaymentAllocation from "src/database/models/PaymentAllocation";
import ReceiptAllocation from "src/database/models/ReceiptAllocation";
import JournalEntry from "src/database/models/JournalEntry";
import { receiptVoucherRepository } from "src/application/features/ReceiptVoucher/repositories/receiptVoucherRepository";
import { paymentVoucherRepository } from "@application/features/PaymentVoucher/repositories/paymentVoucherRepository";
import { customerRepository } from "src/application/features/customers/repositories/customerRepository";
import { supplierRepository } from "src/application/features/suppliers/repositories/supplierRepository";
import { useCashAccounts } from "src/application/features/accounting/hooks/useAccountingData";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, string>) => void;
  goBack: () => void;
}
type VoucherRoute = { params: { voucherId: string } };

type VoucherDetails = {
  voucher: ReceiptVoucher | PaymentVoucher;
  allocations: Array<PaymentAllocation | ReceiptAllocation>;
  entries: JournalEntry[];
};

const dateText = (value: number): string =>
  new Date(value).toLocaleDateString("ar-EG");
const errorText = (value: unknown, fallback: string): string =>
  value instanceof Error ? value.message : fallback;

const Picker: React.FC<{
  title: string;
  value: string;
  items: Array<{ id: string; label: string }>;
  onSelect: (id: string) => void;
}> = ({ title, value, items, onSelect }) => {
  const [visible, setVisible] = useState(false);
  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button mode="outlined" onPress={() => setVisible(true)}>
          {value || title}
        </Button>
      }
    >
      <ScrollView style={styles.menu}>
        {items.map((item) => (
          <Menu.Item
            key={item.id}
            title={item.label}
            onPress={() => {
              onSelect(item.id);
              setVisible(false);
            }}
          />
        ))}
      </ScrollView>
    </Menu>
  );
};

const VoucherList: React.FC<{
  kind: "receipt" | "payment";
  navigation: NavigationProp;
}> = ({ kind, navigation }) => {
  const theme = useTheme();
  const [items, setItems] = useState<Array<ReceiptVoucher | PaymentVoucher>>(
    [],
  );
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const observable =
      kind === "receipt"
        ? receiptVoucherRepository.observeAll()
        : paymentVoucherRepository.observeAll();
    const subscription = observable.subscribe({
      next: (value) => {
        setItems(value);
        setIsLoading(false);
      },
      error: (value) => {
        setError(errorText(value, "تعذر تحميل السندات."));
        setIsLoading(false);
      },
    });
    return () => subscription.unsubscribe();
  }, [kind]);
  const filtered = items.filter(
    (item) =>
      (item.voucherNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (item.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );
  if (isLoading) return <LoadingOverlay visible />;
  if (error)
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Button mode="outlined" onPress={() => setError(null)}>
          إعادة المحاولة
        </Button>
      </View>
    );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={kind === "receipt" ? "سندات القبض" : "سندات الصرف"}
        showBack
        onBack={() => navigation.goBack()}
      />
      <View style={styles.toolbar}>
        <Searchbar
          placeholder="بحث برقم السند أو البيان"
          value={search}
          onChangeText={setSearch}
        />
        <Button
          mode="contained"
          onPress={() =>
            navigation.navigate(
              kind === "receipt" ? "CreateReceipt" : "CreatePayment",
            )
          }
        >
          إنشاء سند
        </Button>
      </View>
      {filtered.length === 0 ? (
        <EmptyState
          icon="receipt-text-outline"
          title="لا توجد سندات"
          subtitle="أنشئ سندًا جديدًا من الزر أعلاه."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              mode="outlined"
              style={styles.card}
              onPress={() =>
                navigation.navigate(
                  kind === "receipt" ? "ReceiptDetails" : "PaymentDetails",
                  { voucherId: item.id },
                )
              }
            >
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium">{item.voucherNumber}</Text>
                  <Text>{dateText(item.voucherDate)}</Text>
                </View>
                <Text>{item.description || "بدون بيان"}</Text>
                <View style={styles.rowBetween}>
                  <CurrencyText amount={item.amount} />
                  <Text>{item.status}</Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export const ReceiptListScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => <VoucherList kind="receipt" navigation={navigation} />;
export const PaymentListScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => <VoucherList kind="payment" navigation={navigation} />;

const CreateVoucher: React.FC<{
  kind: "receipt" | "payment";
  navigation: NavigationProp;
}> = ({ kind, navigation }) => {
  const theme = useTheme();
  const { accounts } = useCashAccounts();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partyId, setPartyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const customerSub = customerRepository.observeAll().subscribe(setCustomers);
    const supplierSub = supplierRepository.observeAll().subscribe(setSuppliers);
    return () => {
      customerSub.unsubscribe();
      supplierSub.unsubscribe();
    };
  }, []);
  const parties =
    kind === "receipt"
      ? customers.map((item) => ({ id: item.id, label: item.name }))
      : suppliers.map((item) => ({ id: item.id, label: item.name }));
  const selectedParty =
    parties.find((item) => item.id === partyId)?.label ?? "";
  const selectedAccount =
    accounts.find((item) => item.id === accountId)?.name ?? "";
  const save = async () => {
    if (isSaving) return;
    const numericAmount = Number(amount);
    const parsedDate = new Date(voucherDate);
    if (
      !partyId ||
      !accountId ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      Number.isNaN(parsedDate.getTime())
    ) {
      setError("اختر الطرف والحساب وأدخل مبلغًا موجبًا.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (kind === "receipt")
        await receiptVoucherRepository.createAndAllocateToCustomer({
          voucherNumber: `REC-${Date.now()}`,
          voucherDate: parsedDate,
          paymentAccountId: accountId,
          customerId: partyId,
          amount: numericAmount,
          description,
          createdBy: "local-user",
        });
      else
        await paymentVoucherRepository.createAndAllocateToSupplier({
          voucherNumber: `PAY-${Date.now()}`,
          voucherDate: parsedDate,
          paymentAccountId: accountId,
          supplierId: partyId,
          amount: numericAmount,
          description,
          createdBy: "local-user",
        });
      navigation.goBack();
    } catch (value) {
      setError(errorText(value, "تعذر حفظ السند."));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title={kind === "receipt" ? "إنشاء سند قبض" : "إنشاء سند صرف"}
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.list}>
        <Picker
          title={kind === "receipt" ? "اختر العميل" : "اختر المورد"}
          value={selectedParty}
          items={parties}
          onSelect={setPartyId}
        />
        <Picker
          title="اختر حساب الصندوق/البنك"
          value={selectedAccount}
          items={accounts.map((item: ChartOfAccount) => ({
            id: item.id,
            label: `${item.code} — ${item.name}`,
          }))}
          onSelect={setAccountId}
        />
        <TextInput
          label="تاريخ السند"
          value={voucherDate}
          onChangeText={setVoucherDate}
          placeholder="YYYY-MM-DD"
          mode="outlined"
        />
        <TextInput
          label="المبلغ"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          mode="outlined"
        />
        <TextInput
          label="البيان"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
        />
        <Text style={styles.muted}>
          سيتم التخصيص آليًا وفق قواعد المستودع، ولن يسمح النظام بتجاوز الرصيد
          المستحق.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button
          mode="contained"
          loading={isSaving}
          disabled={isSaving}
          onPress={() => void save()}
        >
          حفظ السند
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};
export const CreateReceiptScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => <CreateVoucher kind="receipt" navigation={navigation} />;
export const CreatePaymentScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => <CreateVoucher kind="payment" navigation={navigation} />;

const VoucherDetailsScreen: React.FC<{
  kind: "receipt" | "payment";
  navigation: NavigationProp;
  route: VoucherRoute;
}> = ({ kind, navigation, route }) => {
  const theme = useTheme();
  const [details, setDetails] = useState<VoucherDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDetails(
        kind === "receipt"
          ? await receiptVoucherRepository.getDetails(route.params.voucherId)
          : await paymentVoucherRepository.getDetails(route.params.voucherId),
      );
    } catch (value) {
      setError(errorText(value, "تعذر تحميل تفاصيل السند."));
    } finally {
      setIsLoading(false);
    }
  }, [kind, route.params.voucherId]);
  useEffect(() => {
    void load();
  }, [load]);
  const isCancellable =
    details?.voucher?.status === "posted" && !details?.voucher?.isCancelled;
  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    try {
      if (kind === "receipt") {
        await receiptVoucherRepository.cancel(route.params.voucherId);
      } else {
        await paymentVoucherRepository.cancel(route.params.voucherId);
      }
      await load();
    } catch (value) {
      setError(errorText(value, "تعذر إلغاء السند."));
    } finally {
      setIsCancelling(false);
    }
  };
  if (isLoading) return <LoadingOverlay visible />;
  if (!details)
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "السند غير موجود."}</Text>
        <Button onPress={() => void load()}>إعادة المحاولة</Button>
      </View>
    );
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="تفاصيل السند"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.list}>
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge">{details.voucher.voucherNumber}</Text>
            <Text>التاريخ: {dateText(details.voucher.voucherDate)}</Text>
            <Text>المبلغ: {details.voucher.amount}</Text>
            <Text>البيان: {details.voucher.description || "بدون بيان"}</Text>
            <Text>الحالة: {details.voucher.status}</Text>
            <Text>المنشئ: {details.voucher.createdBy}</Text>
          </Card.Content>
        </Card>
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="التخصيصات" />
          <Card.Content>
            {details.allocations.length === 0 ? (
              <Text>لا توجد تخصيصات.</Text>
            ) : (
              details.allocations.map((allocation) => (
                <View key={allocation.id} style={styles.rowBetween}>
                  <Text>
                    {"purchaseInvoice" in allocation ? allocation.purchaseInvoice.id : allocation.salesInvoice.id}
                  </Text>
                  <CurrencyText amount={allocation.amount} />
                </View>
              ))
            )}
          </Card.Content>
        </Card>
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="القيد المحاسبي" />
          <Card.Content>
            {details.entries.length === 0 ? (
              <Text style={styles.error}>لم يتم العثور على القيد المرتبط.</Text>
            ) : (
              details.entries.map((entry) => (
                <Text key={entry.id}>
                  {entry.description || entry.id} — {entry.status}
                </Text>
              ))
            )}
          </Card.Content>
        </Card>
        {isCancellable && (
          <Button
            mode="contained"
            buttonColor="#B42318"
            loading={isCancelling}
            disabled={isCancelling}
            onPress={() => void handleCancel()}
          >
            إلغاء السند
          </Button>
        )}
        <Button mode="outlined" onPress={() => navigation.goBack()}>
          إغلاق
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};
export const ReceiptDetailsScreen: React.FC<{
  navigation: NavigationProp;
  route: VoucherRoute;
}> = (props) => <VoucherDetailsScreen {...props} kind="receipt" />;
export const PaymentDetailsScreen: React.FC<{
  navigation: NavigationProp;
  route: VoucherRoute;
}> = (props) => <VoucherDetailsScreen {...props} kind="payment" />;

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { padding: 12, gap: 8 },
  list: { padding: 12, gap: 10 },
  card: { marginBottom: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  muted: { color: "#667085", marginVertical: 8 },
  error: { color: "#B42318", marginVertical: 8 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menu: { maxHeight: 300 },
});
