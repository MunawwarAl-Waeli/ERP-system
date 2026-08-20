import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "@core/storage/zustandStorage";
import { StoreProfile } from "@core/types";
import { I18nManager } from "react-native";
import i18n from "@core/i18n";

interface SettingsState {
  language: string;
  isDarkMode: boolean;
  storeProfile: StoreProfile;
  setLanguage: (lang: string) => void;
  setDarkMode: (isDark: boolean) => void;
  setStoreProfile: (profile: Partial<StoreProfile>) => void;
  resetSettings: () => void;
}

const DEFAULT_STORE_PROFILE: StoreProfile = {
  name: "",
  address: "",
  phone: "",
  gstNumber: "",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: "en",
      isDarkMode: false,
      storeProfile: DEFAULT_STORE_PROFILE,

      setLanguage: (lang: string) => {
        const isRTL = lang === "ar";
        // if (isRTL) {
          I18nManager.allowRTL(isRTL);
          I18nManager.forceRTL(isRTL);
        // }
        i18n.changeLanguage(lang);

        set({ language: lang });
      },

      setDarkMode: (isDark: boolean) => set({ isDarkMode: isDark }),

      setStoreProfile: (profile: Partial<StoreProfile>) =>
        set((state) => ({
          storeProfile: { ...state.storeProfile, ...profile },
        })),

      resetSettings: () =>
        set({
          language: "en",
          isDarkMode: false,
          storeProfile: DEFAULT_STORE_PROFILE,
        }),
    }),
    {
      name: "settings-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
