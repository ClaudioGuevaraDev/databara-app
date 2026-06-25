import { createContext, use } from "react";
import type { Language } from "../types";
import type { TranslationKey, TranslationParams } from "./translate";

export type I18nContextValue = {
  language: Language;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
  const value = use(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return value;
}
