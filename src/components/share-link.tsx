"use client";

import { useState } from "react";
import { Icon, buttonStyles } from "./ui";

/** Partage d'un lien : copier, WhatsApp, e-mail. */
export function ShareLink({ link, message, subject, email }: { link: string; message: string; subject: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${message}\n${link}`;
  return (
    <div className="space-y-2">
      <p className="break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-slate-200" data-testid="invite-link">
        {link}
      </p>
      <div className="grid gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles.whatsapp}
        >
          <Icon name="whatsapp" /> Envoyer par WhatsApp
        </a>
        <a
          href={`mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
          className={buttonStyles.secondary}
        >
          <Icon name="mail" /> Envoyer par e-mail
        </a>
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Icon name={copied ? "check" : "copy"} /> {copied ? "Lien copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
