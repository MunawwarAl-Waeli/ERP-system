import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "@nozbe/watermelondb/DatabaseProvider";
import { I18nextProvider } from "react-i18next";
import RNBootSplash from "react-native-bootsplash";
import { NotificationHost } from "@shared/notifications";
import i18n from "@core/i18n";
import { database } from "src/database";
import { initializeApplication } from "src/application/compositionRoot";

import { CombinedLightTheme, CombinedDarkTheme } from "@core/theme";

import { useSettingsStore } from "src/application/features/settings/store/useSettingsStore";
import { useSyncStore } from "src/application/features/settings/store/useSyncStore";
import { useAutoSync } from "@shared/hooks/useAutoSync";
import { RootNavigator } from "./navigation/RootNavigator";
import { AppIcon } from "@shared/components/Icon";

const paperSettings = {
  icon: ({
    name,
    size,
    color,
  }: {
    name: string;
    size: number;
    color?: string;
  }) => <AppIcon name={name} size={size} color={color} />,
};

const App: React.FC = () => {
  const { isDarkMode } = useSettingsStore();

  const [isDatabaseReady, setIsDatabaseReady] = useState(false);

  const [databaseError, setDatabaseError] = useState<string | null>(null);

  /**
   * تهيئة قاعدة البيانات والـSeed
   *
   * BootSplash يبقى ظاهراً أثناء هذه العملية.
   */
  useEffect(() => {
    let mounted = true;

    const initializeDatabase = async () => {
      try {
        await initializeApplication();

        if (mounted) {
          setIsDatabaseReady(true);
        }
      } catch (error) {
        console.error("Database initialization failed:", error);

        if (mounted) {
          setDatabaseError(
            error instanceof Error
              ? error.message
              : "حدث خطأ أثناء تهيئة قاعدة البيانات",
          );
        }

        /**
         * لا نترك BootSplash معلقاً للأبد
         * إذا حدث خطأ في التهيئة.
         */
        await RNBootSplash.hide({
          fade: true,
        });
      }
    };

    initializeDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Initialize Google Drive sync on app start
   */
  useEffect(() => {
    useSyncStore.getState().initialize();
  }, []);

  /**
   * Auto-sync when database changes
   * or app comes to foreground.
   */
  useAutoSync();

  // Use user preference, fallback to system
  const theme = isDarkMode ? CombinedDarkTheme : CombinedLightTheme;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paperTheme = theme as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navTheme = theme as any;

  /**
   * في حالة وجود خطأ في تهيئة قاعدة البيانات
   */
  if (databaseError) {
    return (
      <View
        style={[
          styles.errorContainer,
          {
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Text
          style={[
            styles.errorTitle,
            {
              color: theme.colors.onBackground,
            },
          ]}
        >
          تعذر تهيئة قاعدة البيانات
        </Text>

        <Text
          style={[
            styles.errorMessage,
            {
              color: theme.colors.onBackground,
            },
          ]}
        >
          {databaseError}
        </Text>
      </View>
    );
  }

  /**
   * لا نعرض التطبيق قبل اكتمال تهيئة قاعدة البيانات.
   *
   * BootSplash سيبقى ظاهراً في هذه المرحلة.
   */
  if (!isDatabaseReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <I18nextProvider i18n={i18n}>
        <DatabaseProvider database={database}>
          <PaperProvider theme={paperTheme} settings={paperSettings}>
            <SafeAreaProvider>
              <NavigationContainer
                theme={navTheme}
                onReady={() =>
                  RNBootSplash.hide({
                    fade: true,
                  })
                }
              >
                <StatusBar
                  barStyle={isDarkMode ? "light-content" : "dark-content"}
                  backgroundColor={theme.colors.surface}
                />

                <RootNavigator />
              </NavigationContainer>
              <NotificationHost />
            </SafeAreaProvider>
          </PaperProvider>
        </DatabaseProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },

  errorMessage: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
  },
});

export default App;
