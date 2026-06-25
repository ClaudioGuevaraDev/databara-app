import { useI18n } from "../../i18n/I18nContext";

export function EmptyEditor() {
  const { t } = useI18n();
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
      {t("workspace.emptyEditor")}
    </div>
  );
}
