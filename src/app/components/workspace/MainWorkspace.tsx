import { useI18n } from "../../i18n/I18nContext";
import { ResultsDock } from "../results/ResultsDock";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { TabsEditor } from "./TabsEditor";

export function MainWorkspace({
  requiresConnection,
  autoReconnecting,
}: {
  requiresConnection: boolean;
  autoReconnecting: boolean;
}) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-0 min-w-0 flex-col">
      {requiresConnection ? (
        // While reconnecting saved connections on startup, hold off the empty
        // state so it doesn't flash before the dashboard appears.
        autoReconnecting ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-[12px] text-muted-foreground">
            {t("workspace.reconnecting")}
          </div>
        ) : (
          <EmptyWorkspace />
        )
      ) : (
        <>
          <TabsEditor />
          <ResultsDock />
        </>
      )}
    </main>
  );
}
