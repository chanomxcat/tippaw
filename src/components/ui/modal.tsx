"use client";

import { useEffect, useRef } from "react";

// ----------------------------------------------------------------------
// The second shared UI primitive of the MUI -> Tailwind/daisyUI migration.
// A thin wrapper around a native `<dialog>` element styled as a daisyUI
// `modal`. Uses `showModal()`/`close()` imperatively via a ref keyed on the
// `open` prop, which gives `role="dialog"` for free (native `<dialog>`
// elements have that role implicitly). Owns only the open/close chrome —
// the confirm/cancel buttons are left as `children` so each call site
// supplies its own button labels. Task 8 (admin invites) reuses this —
// keep the exported name/signature stable.
// ----------------------------------------------------------------------

export type ModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, children, onClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set right before an effect-driven `dialog.close()` so the `close` event
  // that call dispatches can be told apart from a user-initiated close (native
  // Escape/`cancel`, or the backdrop form's `method="dialog"` submit). Without
  // this, closing programmatically (because `open` already flipped to
  // `false`) would re-invoke `onClose` a second, redundant time on top of the
  // parent's own state change.
  const closingProgrammatically = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      closingProgrammatically.current = true;
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (closingProgrammatically.current) {
      closingProgrammatically.current = false;
      return;
    }
    onClose();
  }

  // Only `close` is wired to `onClose`. The native `cancel` event (Escape)
  // already leads to `close` firing right after by default, so listening on
  // both would call `onClose` twice per Escape press.
  return (
    <dialog ref={ref} className="modal" onClose={handleClose}>
      <div className="modal-box">
        <h3 className="text-lg font-bold">{title}</h3>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
