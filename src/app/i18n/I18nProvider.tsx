import { useMemo, type ReactNode } from "react";
import { useSettings } from "../workspace/workspaceCore";
import { I18nContext, type I18nContextValue } from "./I18nContext";
import { setActiveLocale, translate } from "./translate";

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const language = settings.language.code;

  // Keep the module-level catalog (used by non-React callers like toast and
  // validation messages) in sync with the active language. Doing it during
  // render keeps it consistent for the children rendered in the same pass.
  setActiveLocale(language);

  const value = useMemo<I18nContextValue>(
    () => ({ language, t: (key, params) => translate(key, params) }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
