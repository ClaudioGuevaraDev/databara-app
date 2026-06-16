import { ResultsDock } from "../results/ResultsDock";
import { EmptyWorkspace } from "./EmptyWorkspace";
import { TabsEditor } from "./TabsEditor";

export function MainWorkspace({ requiresConnection }: { requiresConnection: boolean }) {
  return (
    <main className="flex min-w-0 flex-col">
      {requiresConnection ? (
        <EmptyWorkspace />
      ) : (
        <>
          <TabsEditor />
          <ResultsDock />
        </>
      )}
    </main>
  );
}
