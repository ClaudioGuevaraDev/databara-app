import { useObjectDetailsPanel } from "../../workspace/workspaceCore";
import { ObjectDetails } from "./ObjectDetails";

export function ObjectDetailsPanel() {
  const objectDetails = useObjectDetailsPanel();

  return (
    <ObjectDetails
      details={objectDetails.details}
      onCopyName={() => void objectDetails.copyObjectName()}
      onLoadDdl={() => void objectDetails.loadDdl()}
      onPreview={() => void objectDetails.previewObject()}
      onRefresh={() => void objectDetails.refreshAll()}
    />
  );
}
