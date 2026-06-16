import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton title="Close" onClick={onClick}>
      <X size={15} />
    </IconButton>
  );
}
