"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
export default function Dialog({
  title,
  children,
  footer,
  onRequestClose,
  returnFocus,
  busy = false,
  alert = false,
  focusKey = "",
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  onRequestClose: () => void;
  returnFocus: HTMLElement | null;
  busy?: boolean;
  alert?: boolean;
  focusKey?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        const target = returnFocus?.isConnected
          ? returnFocus
          : document.querySelector<HTMLElement>(".admin-list-heading .primary");
        target?.focus({ preventScroll: true });
      });
    };
  }, [returnFocus]);
  useLayoutEffect(() => {
    const element =
      ref.current?.querySelector<HTMLElement>("[data-initial-focus]") ||
      ref.current?.querySelector<HTMLElement>("input:not([disabled])") ||
      ref.current?.querySelector<HTMLElement>("button:not([disabled])");
    element?.focus({ preventScroll: true });
  }, [focusKey]);
  return (
    <dialog
      ref={ref}
      className="crud-dialog"
      role={alert ? "alertdialog" : "dialog"}
      aria-labelledby="crud-dialog-title"
      aria-describedby={alert ? "crud-confirm-message" : undefined}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const elements = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            closeRef.current();
        }
      }}
    >
      <header className="crud-dialog-header">
        <h2 id="crud-dialog-title">{title}</h2>
        <button
          className="close"
          type="button"
          disabled={busy}
          aria-label="Đóng dialog"
          onClick={onRequestClose}
        >
          ×
        </button>
      </header>
      <div className="crud-dialog-body">{children}</div>
      <footer className="crud-dialog-footer">{footer}</footer>
    </dialog>
  );
}
