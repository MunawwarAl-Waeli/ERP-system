// src/features/settings/screens/SystemDiagnosticScreen.tsx
import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
  useTheme,
  Card,
  Text,
  Button,
  List,
  Surface,
  ActivityIndicator,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@shared/components/AppHeader";
import { paperIcon } from "@shared/components/Icon";
import {
  runFullSystemDiagnostic,
  DiagnosticResult,
} from "@core/diagnostics/systemCheck";

export const SystemDiagnosticScreen: React.FC = () => {
  const theme = useTheme();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunDiagnostic = async () => {
    setIsRunning(true);
    try {
      const checkResults = await runFullSystemDiagnostic();
      setResults(checkResults);
    } catch (error) {
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <AppHeader title="فحص وتأكيد النظام" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.actionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              بدء التشخيص المحاسبي
            </Text>
            <Text variant="bodySmall" style={{ marginBottom: 16 }}>
              سيقوم النظام بفحص كافة الفواتير والقيود والعملاء للتأكد من النزاهة
              المالية.
            </Text>
            <Button
              mode="contained"
              onPress={handleRunDiagnostic}
              loading={isRunning}
              disabled={isRunning}
              icon={paperIcon("play")}
            >
              تشغيل الفحص الشامل
            </Button>
          </Card.Content>
        </Card>

        {results.length > 0 && (
          <Surface style={styles.resultsSurface} elevation={1}>
            <Text variant="titleMedium" style={styles.resultsTitle}>
              نتائج الفحص:
            </Text>
            {results.map((res, index) => (
              <View
                key={index}
                style={[
                  styles.resultItem,
                  { borderBottomColor: theme.colors.outlineVariant },
                ]}
              >
                <View style={styles.resultHeader}>
                  <Text variant="bodyMedium" style={{ fontWeight: "bold" }}>
                    {res.testName}
                  </Text>
                  <List.Icon
                    icon={paperIcon(
                      res.status === "pass"
                        ? "check-circle"
                        : res.status === "fail"
                        ? "alert-circle"
                        : "alert",
                    )}
                    color={
                      res.status === "pass"
                        ? "#4CAF50"
                        : res.status === "fail"
                        ? theme.colors.error
                        : "#FF9800"
                    }
                  />
                </View>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurface, marginTop: 4 }}
                >
                  {res.message}
                </Text>
                {res.details && res.details.length > 0 && (
                  <View
                    style={[
                      styles.detailsBox,
                      { backgroundColor: theme.colors.errorContainer },
                    ]}
                  >
                    {res.details.map((detail, dIndex) => (
                      <Text
                        key={dIndex}
                        variant="bodySmall"
                        style={{ color: theme.colors.onErrorContainer }}
                      >
                        • {detail}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  actionCard: { marginBottom: 16, borderRadius: 12 },
  cardTitle: { fontWeight: "bold", marginBottom: 8 },
  resultsSurface: { padding: 16, borderRadius: 12, marginBottom: 32 },
  resultsTitle: { fontWeight: "bold", marginBottom: 12 },
  detailsBox: { marginTop: 8, padding: 8, borderRadius: 6 },
  resultItem: { paddingVertical: 12, borderBottomWidth: 1 },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
