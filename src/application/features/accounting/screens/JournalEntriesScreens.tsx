import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
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

const parseDate = (value: string): Date | undefined => {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

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

export const JournalEntriesScreen: React.FC<{ navigation: NavigationProp }> = ({
  navigation,
}) => {
  const theme = useTheme();
  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEntries(
        await reportService.getJournalEntries(
          search,
          parseDate(from),
          parseDate(to),
        ),
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "تعذر تحميل القيود اليومية.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [from, search, to]);

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
      <View style={styles.filters}>
        <Searchbar
          placeholder="بحث في البيان أو المرجع"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.row}>
          <TextInput
            label="من تاريخ"
            value={from}
            onChangeText={setFrom}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
          <TextInput
            label="إلى تاريخ"
            value={to}
            onChangeText={setTo}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
        </View>
        <Button mode="outlined" onPress={() => void load()}>
          تحديث
        </Button>
      </View>
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
              mode="outlined"
              style={styles.card}
              onPress={() =>
                navigation.navigate("JournalEntryDetails", { entryId: item.id })
              }
            >
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium">#{item.id.slice(0, 8)}</Text>
                  <Text>{formatDate(item.entryDate)}</Text>
                </View>
                <Text>{item.description || "بدون بيان"}</Text>
                <Text style={styles.muted}>
                  {item.referenceType || "بدون مرجع"} {item.referenceId || ""}
                </Text>
                <View style={styles.rowBetween}>
                  <CurrencyText
                    amount={item.totalDebit}
                    color={theme.colors.primary}
                  />
                  <CurrencyText
                    amount={item.totalCredit}
                    color={theme.colors.tertiary}
                  />
                  <Text
                    style={{
                      color:
                        Math.abs(item.totalDebit - item.totalCredit) < 0.001
                          ? theme.colors.primary
                          : theme.colors.error,
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export const JournalEntryDetailsScreen: React.FC<{
  navigation: NavigationProp;
  route: JournalRoute;
}> = ({ navigation, route }) => {
  const theme = useTheme();
  const [details, setDetails] = useState<JournalEntryDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDetails(
        await reportService.getJournalEntryDetails(route.params.entryId),
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "تعذر تحميل تفاصيل القيد.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [route.params.entryId]);

  useEffect(() => {
    void load();
  }, [load]);
  if (isLoading) return <LoadingOverlay visible />;
  if (error || !details)
    return (
      <ScreenError
        message={error ?? "القيد غير موجود."}
        onRetry={() => void load()}
      />
    );
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
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge">قيد #{details.id.slice(0, 8)}</Text>
            <Text>التاريخ: {formatDate(details.entryDate)}</Text>
            <Text>البيان: {details.description || "بدون بيان"}</Text>
            <Text>المصدر: {details.referenceType || "غير محدد"}</Text>
            <Text>المرجع: {details.referenceId || "غير محدد"}</Text>
            <Text>المنشئ: {details.createdBy || "غير محدد"}</Text>
            <Text>الحالة: {details.status}</Text>
            {details.isReversed && (
              <Text style={styles.warning}>هذا القيد تم عكسه.</Text>
            )}
          </Card.Content>
        </Card>
        <Card mode="outlined" style={styles.card}>
          <Card.Title title="سطور القيد" />
          <Card.Content>
            {details.lines.map((line) => (
              <View key={line.id} style={styles.line}>
                <View style={styles.flex}>
                  <Text>
                    {line.accountCode} — {line.accountName}
                  </Text>
                </View>
                <CurrencyText amount={line.debit} />
                <CurrencyText
                  amount={line.credit}
                  color={theme.colors.tertiary}
                />
              </View>
            ))}
            <Divider />
            <View style={styles.rowBetween}>
              <Text>إجمالي المدين</Text>
              <CurrencyText amount={details.totalDebit} />
            </View>
            <View style={styles.rowBetween}>
              <Text>إجمالي الدائن</Text>
              <CurrencyText
                amount={details.totalCredit}
                color={theme.colors.tertiary}
              />
            </View>
            <Text
              style={[
                styles.balanceNotice,
                { color: balanced ? theme.colors.primary : theme.colors.error },
              ]}
            >
              {balanced
                ? "القيد متوازن: المدين = الدائن"
                : "تحذير: القيد غير متوازن"}
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

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
        {accounts.map((account) => (
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialId)
      setSelected(accounts.find((account) => account.id === initialId) ?? null);
  }, [accounts, initialId]);

  const load = useCallback(async () => {
    if (!selected) return;
    setIsLoading(true);
    setError(null);
    try {
      setReport(await loadReport(selected.id, parseDate(from), parseDate(to)));
    } catch (value) {
      setError(value instanceof Error ? value.message : "تعذر تحميل التقرير.");
    } finally {
      setIsLoading(false);
    }
  }, [from, loadReport, selected, to]);

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
            value={from}
            onChangeText={setFrom}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
          />
          <TextInput
            label="إلى تاريخ"
            value={to}
            onChangeText={setTo}
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
                    <Text style={styles.muted}>
                      {row.referenceType || ""} {row.referenceId || ""}
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
  filters: { padding: 12, gap: 8 },
  list: { padding: 12, gap: 10 },
  card: { marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  dateInput: { flex: 1, backgroundColor: "transparent" },
  muted: { color: "#6B7280", marginTop: 4 },
  error: { color: "#B42318", marginBottom: 12, textAlign: "center" },
  warning: { color: "#B54708", marginTop: 8 },
  balanceNotice: { fontWeight: "700", marginTop: 12, textAlign: "center" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuScroll: { maxHeight: 280 },
});
