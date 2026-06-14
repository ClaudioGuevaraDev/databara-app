import type { ElementType } from "react";

export function SmallAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="control flex h-8 items-center gap-1.5 rounded px-2 text-[12px]"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
