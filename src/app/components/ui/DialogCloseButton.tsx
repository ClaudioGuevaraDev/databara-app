import { X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { IconButton } from "./IconButton";

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <IconButton title={t("common.close")} onClick={onClick}>
      <X size={15} />
    </IconButton>
  );
}
