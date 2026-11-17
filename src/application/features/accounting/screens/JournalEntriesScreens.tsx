import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  Platform,
  TouchableOpacity,
} from "react-native";
import {
  Button,
  Card,
  Divider,
  Menu,
  Searchbar,
  Text,
  TextInput,
  useTheme,
  Chip,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { EmptyState } from "@shared/components/EmptyState";
import { LoadingOverlay } from "@shared/components/LoadingOverlay";
import { CurrencyText } from "@shared/components/CurrencyText";
import { AppIcon } from "@shared/components/Icon";
import { useAccounts } from "../hooks/useAccountingData";
import {
  JournalEntryDetails,
  JournalEntrySummary,
  LedgerReport,
  TrialBalanceReport,
  reportService,
} from "src/application/features/reports/services/reportService";
import ChartOfAccount from "src/database/models/ChartOfAccount";

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, string>) => void;
  goBack: () => void;
}

type JournalRoute = { params: { entryId: string } };
type AccountRoute = { params: { accountId?: string } };

const formatDate = (value: number): string =>
  new Date(value).toLocaleDateString("ar-EG");

const ScreenError: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <View style={styles.centered}>
    <Text style={styles.error}>{message}</Text>
    <Button mode="outlined" onPress={onRetry}>
      إعادة المحاولة
    </Button>
  </View>
);

// ==========================================
// 1. شاشة قائمة القيود اليومية
// ==========================================
export const JournalEntriesScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEntries(
        await reportService.getJournalEntries(search, fromDate, toDate),
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "تعذر تحميل القيود اليومية.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, search, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <LoadingOverlay visible />;
  if (error) return <ScreenError message={error} onRetry={() => void load()} />;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="القيود اليومية"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={[styles.filters, { backgroundColor: theme.colors.surface }]}>
        <Searchbar
          placeholder="بحث في البيان أو المرجع..."
          value={search}
          onChangeText={setSearch}
          style={{
            marginBottom: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
          inputStyle={{ fontSize: 14 }}
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.dateBtn, { borderColor: theme.colors.outline }]}
            onPress={() => setShowFromPicker(true)}
          >
            <AppIcon name="calendar" size={16} color={theme.colors.primary} />
            <Text variant="bodySmall" style={{ marginLeft: 4 }}>
              {fromDate ? formatDate(fromDate.getTime()) : "من تاريخ"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, { borderColor: theme.colors.outline }]}
            onPress={() => setShowToPicker(true)}
          >
            <AppIcon name="calendar" size={16} color={theme.colors.primary} />
            <Text variant="bodySmall" style={{ marginLeft: 4 }}>
              {toDate ? formatDate(toDate.getTime()) : "إلى تاريخ"}
            </Text>
          </TouchableOpacity>
        </View>

        {(fromDate || toDate || search) && (
          <Button
            mode="text"
            compact
            onPress={() => {
              setFromDate(undefined);
              setToDate(undefined);
              setSearch("");
            }}
          >
            مسح الفلاتر
          </Button>
        )}
      </View>

      {showFromPicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display="default"
          onChange={(e, date) => {
            setShowFromPicker(Platform.OS === "ios");
            if (date) setFromDate(date);
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display="default"
          onChange={(e, date) => {
            setShowToPicker(Platform.OS === "ios");
            if (date) setToDate(date);
          }}
        />
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon="book-open-outline"
          title="لا توجد قيود يومية"
          subtitle="ستظهر القيود بعد ترحيل العمليات المحاسبية."
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              mode="elevated"
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: 12,
                  elevation: 2,
                },
              ]}
              onPress={() =>
                navigation.navigate("JournalEntryDetails", { entryId: item.id })
              }
            >
              <View style={{ padding: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: theme.colors.primaryContainer,
                        padding: 6,
                        borderRadius: 8,
                      }}
                    >
                      <AppIcon
                        name="book-open-page-variant"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View>
                      <Text variant="titleSmall" style={{ fontWeight: "bold" }}>
                        قيد #{item.id.slice(0, 6)}
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {formatDate(item.entryDate)}
                      </Text>
                    </View>
                  </View>
                  <Chip
                    compact
                    textStyle={{
                      fontSize: 10,
                      color: theme.colors.onSecondaryContainer,
                    }}
                    style={{ backgroundColor: theme.colors.secondaryContainer }}
                  >
                    {item.status === "posted" ? "مرحل" : item.status}
                  </Chip>
                </View>

                <Text
                  variant="bodyMedium"
                  style={{ marginBottom: 12, color: theme.colors.onSurface }}
                  numberOfLines={2}
                >
                  {item.description || "بدون بيان"}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.surfaceVariant,
                    paddingTop: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.surfaceVariant,
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.primary,
                        fontWeight: "bold",
                      }}
                    >
                      مدين
                    </Text>
                    <CurrencyText
                      amount={item.totalDebit}
                      color={theme.colors.primary}
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.colors.surfaceVariant,
                      padding: 8,
                      borderRadius: 8,
                      marginLeft: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.tertiary,
                        fontWeight: "bold",
                      }}
                    >
                      دائن
                    </Text>
                    <CurrencyText
                      amount={item.totalCredit}
                      color={theme.colors.tertiary}
                    />
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

// ==========================================
// 2. شاشة تفاصيل القيد (تم تحويلها لجدول)
// ==========================================
export const JournalEntryDetailsScreen: React.FC<{
  navigation: NavigationProp;
  route: JournalRoute;
}> = ({ navigation, route }) => {
  const theme = useTheme();
  const [details, setDetails] = useState<JournalEntryDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const entryId = route?.params?.entryId;
    if (!entryId) {
      setError("معرف القيد غير صالح.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setDetails(await reportService.getJournalEntryDetails(entryId));
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "تعذر تحميل تفاصيل القيد.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [route?.params?.entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <LoadingOverlay visible />;
  if (error || !details) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        <AppHeader
          title="تفاصيل القيد"
          showBack
          onBack={() => navigation.goBack()}
        />
        <ScreenError
          message={error ?? "القيد غير موجود."}
          onRetry={() => void load()}
        />
      </SafeAreaView>
    );
  }

  const balanced = Math.abs(details.totalDebit - details.totalCredit) < 0.001;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="تفاصيل القيد"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.list}>
        <Card mode="elevated" style={{ marginBottom: 12 }}>
          <Card.Content>
            <View style={styles.rowBetween}>
              <Text variant="titleLarge" style={{ fontWeight: "bold" }}>
                قيد #{details.id.slice(0, 8)}
              </Text>
              <Chip compact>{details.status}</Chip>
            </View>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="bodyMedium">
              التاريخ: {formatDate(details.entryDate)}
            </Text>
            <Text variant="bodyMedium">
              البيان: {details.description || "بدون بيان"}
            </Text>
            <Text variant="bodyMedium">
              المصدر: {details.referenceType || "غير محدد"}
            </Text>
            {details.isReversed && (
              <Text
                style={{
                  color: theme.colors.error,
                  marginTop: 8,
                  fontWeight: "bold",
                }}
              >
                ⚠️ هذا القيد تم عكسه
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card mode="elevated">
          <Card.Title title="سطور القيد" titleStyle={{ fontSize: 16 }} />
          <Card.Content style={{ paddingHorizontal: 0 }}>
            {/* ✅ الجدول هنا مع سكرول أفقي */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={{ minWidth: "100%", paddingBottom: 10 }}>
                {/* رأس الجدول */}
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: theme.colors.surfaceVariant,
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 8,
                    marginHorizontal: 12,
                  }}
                >
                  <Text
                    style={{
                      width: 40,
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    #
                  </Text>
                  <Text
                    style={{
                      width: 160,
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    الحساب
                  </Text>
                  <Text
                    style={{
                      width: 90,
                      textAlign: "center",
                      fontWeight: "bold",
                      color: theme.colors.primary,
                    }}
                  >
                    مدين
                  </Text>
                  <Text
                    style={{
                      width: 90,
                      textAlign: "center",
                      fontWeight: "bold",
                      color: theme.colors.tertiary,
                    }}
                  >
                    دائن
                  </Text>
                </View>

                {/* صفوف الجدول */}
                {details.lines.map((line, index) => (
                  <View
                    key={line.id}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.colors.surfaceVariant,
                      marginHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        width: 40,
                        textAlign: "center",
                        color: theme.colors.onSurfaceVariant,
                      }}
                    >
                      {index + 1}
                    </Text>
                    <View style={{ width: 160, paddingRight: 4 }}>
                      <Text
                        style={{ fontWeight: "bold", textAlign: "right" }}
                        numberOfLines={1}
                      >
                        {line.accountName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: theme.colors.onSurfaceVariant,
                          textAlign: "right",
                        }}
                      >
                        {line.accountCode}
                      </Text>
                    </View>
                    <Text
                      style={{
                        width: 90,
                        textAlign: "center",
                        fontWeight: "bold",
                        color:
                          line.debit > 0
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {line.debit > 0 ? line.debit.toFixed(2) : "-"}
                    </Text>
                    <Text
                      style={{
                        width: 90,
                        textAlign: "center",
                        fontWeight: "bold",
                        color:
                          line.credit > 0
                            ? theme.colors.tertiary
                            : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {line.credit > 0 ? line.credit.toFixed(2) : "-"}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <Divider style={{ marginVertical: 12, marginHorizontal: 12 }} />

            <View style={{ marginHorizontal: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={{ fontWeight: "bold" }}>إجمالي المدين</Text>
                <CurrencyText
                  amount={details.totalDebit}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={{ fontWeight: "bold" }}>إجمالي الدائن</Text>
                <CurrencyText
                  amount={details.totalCredit}
                  color={theme.colors.tertiary}
                />
              </View>
              <Text
                style={[
                  styles.balanceNotice,
                  {
                    color: balanced ? theme.colors.primary : theme.colors.error,
                  },
                ]}
              >
                {balanced ? "✅ القيد متوازن" : "⚠️ تحذير: القيد غير متوازن"}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 3. بقية الشاشات (الأستاذ العام، ميزان المراجعة، إلخ)
// ==========================================
const AccountMenu: React.FC<{
  accounts: ChartOfAccount[];
  selected: ChartOfAccount | null;
  onSelect: (account: ChartOfAccount) => void;
}> = ({ accounts, selected, onSelect }) => {
  const [visible, setVisible] = useState(false);
  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button mode="outlined" onPress={() => setVisible(true)}>
          {selected ? `${selected.code} — ${selected.name}` : "اختر الحساب"}
        </Button>
      }
    >
      <ScrollView style={styles.menuScroll}>
        {(accounts || []).map((account) => (
          <Menu.Item
            key={account.id}
            title={`${account.code} — ${account.name}`}
            onPress={() => {
              onSelect(account);
              setVisible(false);
            }}
          />
        ))}
      </ScrollView>
    </Menu>
  );
};

const AccountReportScreen: React.FC<{
  navigation: NavigationProp;
  route?: AccountRoute;
  title: string;
  loadReport: (
    accountId: string,
    from?: Date,
    to?: Date,
  ) => Promise<LedgerReport>;
}> = ({ navigation, route, title, loadReport }) => {
  const theme = useTheme();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const initialId = route?.params?.accountId;
  const [selected, setSelected] = useState<ChartOfAccount | null>(null);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialId)
      setSelected(
        (accounts || []).find((account) => account.id === initialId) ?? null,
      );
  }, [accounts, initialId]);

  const load = useCallback(async () => {
    if (!selected) return;
    setIsLoading(true);
    setError(null);
    try {
      setReport(await loadReport(selected.id, fromDate, toDate));
    } catch (value) {
      setError(value instanceof Error ? value.message : "تعذر تحميل التقرير.");
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, loadReport, selected, toDate]);

  const rows = useMemo(() => report?.rows ?? [], [report]);
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader title={title} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.list}>
        {accountsLoading ? (
          <LoadingOverlay visible />
        ) : (
          <AccountMenu
            accounts={accounts}
            selected={selected}
            onSelect={setSelected}
          />
        )}

        <View style={styles.row}>
          <TextInput
            label="من تاريخ"
            value={fromDate ? fromDate.toISOString().slice(0, 10) : ""}
            onChangeText={() => {}}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
          <TextInput
            label="إلى تاريخ"
            value={toDate ? toDate.toISOString().slice(0, 10) : ""}
            onChangeText={() => {}}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
        </View>
        <Button
          mode="contained"
          disabled={!selected || isLoading}
          loading={isLoading}
          onPress={() => void load()}
        >
          عرض التقرير
        </Button>
        {error && <ScreenError message={error} onRetry={() => void load()} />}
        {report && (
          <>
            <Card mode="outlined" style={styles.card}>
              <Card.Content>
                <Text>
                  الرصيد الافتتاحي:{" "}
                  <CurrencyText amount={report.openingBalance} />
                </Text>
                <Text>
                  الرصيد الختامي:{" "}
                  <CurrencyText amount={report.closingBalance} />
                </Text>
              </Card.Content>
            </Card>
            {rows.length === 0 ? (
              <EmptyState
                icon="file-outline"
                title="لا توجد حركات"
                subtitle="لا توجد قيود ضمن الفترة المحددة."
              />
            ) : (
              rows.map((row) => (
                <Card key={row.id} mode="outlined" style={styles.card}>
                  <Card.Content>
                    <Text>
                      {formatDate(row.date)} — {row.description || "بدون بيان"}
                    </Text>
                    <View style={styles.rowBetween}>
                      <CurrencyText amount={row.debit} />
                      <CurrencyText
                        amount={row.credit}
                        color={theme.colors.tertiary}
                      />
                      <Text>الرصيد: {row.runningBalance.toFixed(2)}</Text>
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const GeneralLedgerScreen: React.FC<{
  navigation: NavigationProp;
  route?: AccountRoute;
}> = (props) => (
  <AccountReportScreen
    {...props}
    title="الأستاذ العام"
    loadReport={reportService.getGeneralLedger}
  />
);

export const AccountStatementScreen: React.FC<{
  navigation: NavigationProp;
  route?: AccountRoute;
}> = (props) => (
  <AccountReportScreen
    {...props}
    title="كشف الحساب"
    loadReport={reportService.getAccountStatement}
  />
);

export const TrialBalanceScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await reportService.getTrialBalance());
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "تعذر تحميل ميزان المراجعة.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (isLoading) return <LoadingOverlay visible />;
  if (error || !report)
    return (
      <ScreenError
        message={error ?? "لا توجد بيانات."}
        onRetry={() => void load()}
      />
    );
  const balanced = Math.abs(report.difference) < 0.001;
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <AppHeader
        title="ميزان المراجعة"
        showBack
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={report.rows}
        keyExtractor={(item) => item.accountId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="scale-balance"
            title="لا توجد حسابات"
            subtitle="أضف حسابات نشطة إلى دليل الحسابات."
          />
        }
        renderItem={({ item }) => (
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">
                {item.code} — {item.name}
              </Text>
              <View style={styles.rowBetween}>
                <CurrencyText amount={item.debit} />
                <CurrencyText
                  amount={item.credit}
                  color={theme.colors.tertiary}
                />
                <Text>الرصيد: {item.balance.toFixed(2)}</Text>
              </View>
            </Card.Content>
          </Card>
        )}
        ListFooterComponent={
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text>إجمالي المدين: {report.totalDebit.toFixed(2)}</Text>
              <Text>إجمالي الدائن: {report.totalCredit.toFixed(2)}</Text>
              <Text
                style={{
                  color: balanced ? theme.colors.primary : theme.colors.error,
                }}
              >
                {balanced
                  ? "الميزان متوازن"
                  : `تحذير: الفرق ${report.difference.toFixed(2)}`}
              </Text>
            </Card.Content>
          </Card>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: {
    padding: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 2,
    marginBottom: 8,
  },
  list: { padding: 12, gap: 10, paddingBottom: 30 },
  card: { marginBottom: 8, borderRadius: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  dateInput: { flex: 1, backgroundColor: "transparent" },
  error: { color: "#B42318", marginBottom: 12, textAlign: "center" },
  balanceNotice: { fontWeight: "700", marginTop: 12, textAlign: "center" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuScroll: { maxHeight: 280 },
});
