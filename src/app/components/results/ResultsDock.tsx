import { useResults } from "../../workspace/workspaceCore";
import { ResultsPanel } from "./ResultsPanel";

export function ResultsDock() {
  const results = useResults();

  if (!results.resultsOpen) return null;

  return (
    <ResultsPanel
      activeTab={results.resultTab}
      details={results.details}
      queryResult={results.queryResult}
      queryState={results.queryState}
      onClose={results.closeResults}
      onCopy={() => void results.copyResult()}
      onExport={results.exportCsv}
      onTabChange={results.selectResultTab}
    />
  );
}
