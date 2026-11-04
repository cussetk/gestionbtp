"use client";

import { useFormStatus } from "react-dom";
import { useOffline } from "next/offline";
import { buttonStyles, cx } from "./ui";

/** Bouton d'envoi : indique l'enregistrement en cours, et l'attente de réseau hors ligne. */
export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  variant = "primary",
  className,
  confirm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  /** Message de confirmation avant envoi (actions irréversibles). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const offline = useOffline();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(buttonStyles[variant], className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (offline ? "En attente du réseau…" : pendingLabel) : children}
    </button>
  );
}
