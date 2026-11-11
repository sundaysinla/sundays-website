"use client";

import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export default function MeetDialog({ title, description, onClose, children, wide = false }: {
  title: string; description: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const returnTo = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement);
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="meet-surface meet-overlay" />
        <Dialog.Content className={`meet-surface meet-dialog ${wide ? "meet-dialog-wide" : ""}`}
          onCloseAutoFocus={event => { event.preventDefault(); const target = returnTo.current; if (target?.isConnected) target.focus(); else document.getElementById("meet-results-title")?.focus(); }}>
          <Dialog.Close className="meet-icon-button meet-dialog-close" aria-label="Close"><X size={19} /></Dialog.Close>
          <header className="meet-dialog-heading">
            <Dialog.Title className="meet-dialog-title">{title}</Dialog.Title>
            <Dialog.Description className="meet-dialog-description">{description}</Dialog.Description>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
