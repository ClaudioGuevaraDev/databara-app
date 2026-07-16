import { Database, HardDriveUpload, KeyRound, Plus } from "lucide-react";
import { connectionEngineLabel } from "../../connectionEngines";
import { useI18n } from "../../i18n/I18nContext";
import { savedConnectionNodeId, useEmptyWorkspace } from "../../workspace/workspaceCore";
import { NoConnectionEmptySvg } from "./NoConnectionEmptySvg";
import { SavedConnectionEmptySvg } from "./SavedConnectionEmptySvg";

export function EmptyWorkspace() {
  const { t } = useI18n();
  const empty = useEmptyWorkspace();

  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background px-8">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.28)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.22)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />
      <div className="relative grid w-full max-w-[550px] justify-items-center gap-5 text-center">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto h-32 w-40 rounded-[50%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.2),transparent)]"
          />
          <span className="relative">
            {empty.hasStoredConnections ? <SavedConnectionEmptySvg /> : <NoConnectionEmptySvg />}
          </span>
        </div>
        <div className="grid gap-2">
          <h2 className="text-[18px] font-semibold text-foreground">
            {empty.hasStoredConnections ? t("workspace.empty.noActive") : t("workspace.empty.none")}
          </h2>
          {empty.hasStoredConnections ? null : (
            <p className="max-w-[460px] text-[13px] leading-6 text-muted-foreground">
              {t("workspace.empty.description")}
            </p>
          )}
        </div>
        {empty.hasStoredConnections ? (
          <div className="chrome-panel hairline w-full max-w-[600px] overflow-hidden rounded-lg border border-border text-left shadow-[0_8px_22px_hsl(var(--shadow-strong)/0.14)] dark:shadow-[0_18px_54px_hsl(var(--shadow-strong)/0.34)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-8 gap-y-2 border-b border-border px-4 py-3">
              <div className="max-w-[280px]">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t("workspace.empty.savedConnections")}
                  </div>
                  <div className="rounded-full border border-primary/20 bg-[hsl(var(--primary)/0.1)] px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {empty.storedConnections.length}
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {t("workspace.empty.chooseSession")}
                </div>
              </div>
              <div className="flex items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={empty.openNewConnectionDialog}
                  className="flex h-8 items-center gap-1.5 rounded border border-primary/25 bg-[hsl(var(--primary)/0.08)] px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-[hsl(var(--primary)/0.14)]"
                >
                  <Plus size={13} />
                  {t("workspace.empty.newConnection")}
                </button>
                <button
                  type="button"
                  onClick={empty.openLoadConfigDialog}
                  className="flex h-8 items-center gap-1.5 rounded border border-border px-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <HardDriveUpload size={13} />
                  {t("workspace.empty.loadConfiguration")}
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              <div className="grid gap-2">
                {empty.storedConnections.map((connection) => {
                  const nodeId = savedConnectionNodeId(connection);

                  return (
                    <div
                      key={nodeId}
                      className="group flex items-center gap-3 rounded-md border border-border bg-[linear-gradient(180deg,hsl(var(--panel-soft)/0.86),hsl(var(--panel)/0.92))] px-3 py-3 transition-colors hover:border-primary/35"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(180deg,hsl(var(--primary)/0.16),hsl(var(--primary)/0.08))] text-primary shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]">
                        <KeyRound size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-foreground">
                          {connection.database}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {connectionEngineLabel(connection.engine)} · {connection.user}@
                          {connection.host}:{connection.port}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => empty.openSavedConnection(nodeId)}
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded border border-primary/25 bg-[hsl(var(--primary)/0.12)] px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-[hsl(var(--primary)/0.18)]"
                      >
                        <Database size={13} />
                        {t("workspace.empty.connect")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              onClick={empty.openNewConnectionDialog}
              className="flex h-9 items-center gap-2 rounded bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.16)] hover:brightness-110"
            >
              <Plus size={15} />
              {t("workspace.empty.connection")}
            </button>
            <button
              onClick={empty.openLoadConfigDialog}
              className="flex h-9 items-center gap-2 rounded border border-border px-3.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <HardDriveUpload size={15} />
              {t("workspace.empty.loadConfiguration")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
