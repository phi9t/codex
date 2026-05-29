import { X } from "lucide-react";
import { type ReactNode } from "react";

type DetailDrawerProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailDrawer({
  isOpen,
  title,
  onClose,
  children,
}: DetailDrawerProps): ReactNode {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="detail-drawer__header">
        <h3>{title}</h3>
        <button
          type="button"
          className="detail-drawer__close"
          onClick={onClose}
          aria-label="Close detail drawer"
        >
          <X aria-hidden />
        </button>
      </div>
      <div className="detail-drawer__content">{children}</div>
    </aside>
  );
}
