import { Save } from "lucide-react";
import { DialogActions, DialogBody, DialogCloseButton, DialogFrame, DialogHeader } from "../ui";

export function UnsavedTabsDialog({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <DialogFrame maxWidth="max-w-[460px]">
      <DialogHeader
        title={
          <>
            <Save size={16} className="shrink-0 text-primary" />
            <span className="truncate">Unsaved tabs</span>
          </>
        }
      >
        <DialogCloseButton onClick={onCancel} />
      </DialogHeader>
      <DialogBody className="grid gap-3 text-[12px] text-muted-foreground">
        <div>There are SQL tabs with unsaved changes.</div>
        <div>Save them before closing the app?</div>
      </DialogBody>
      <DialogActions>
        <button onClick={onCancel} className="control h-8 rounded px-3 text-[12px]">
          Cancel
        </button>
        <button onClick={onDiscard} className="control h-8 rounded px-3 text-[12px]">
          Don&apos;t save
        </button>
        <button
          onClick={onSave}
          className="flex h-8 items-center gap-1.5 rounded bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
        >
          <Save size={14} />
          Save
        </button>
      </DialogActions>
    </DialogFrame>
  );
}
