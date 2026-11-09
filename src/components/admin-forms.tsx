"use client";

import { useActionState, useState } from "react";
import { addNoteAction, setPlanAction, setStatusAction, type AdminFormState } from "@/app/admin/actions";
import { PLANS } from "@/lib/validation";
import { Field, FormError, TextArea, buttonStyles, cx } from "./ui";
import { SubmitButton } from "./submit-button";

function Ok({ text }: { text?: string }) {
  if (!text) return null;
  return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{text}</p>;
}

export function StatusActions({
  orgId,
  status: initialStatus,
  orgName,
}: {
  orgId: string;
  status: "en_attente" | "active" | "suspendue";
  orgName: string;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(setStatusAction, {});
  // État au moment de l'ouverture du formulaire de suspension : il reste ouvert tant
  // qu'aucune décision n'a abouti (ou en cas d'erreur, ex. motif manquant).
  const [openedAt, setOpenedAt] = useState<AdminFormState | null>(null);
  const status = state.status ?? initialStatus;
  const suspending = openedAt !== null && (openedAt === state || (!!state.errors && !state.ok));
  const setSuspending = (open: boolean) => setOpenedAt(open ? state : null);
  const e = state.errors ?? {};
  return (
    <div className="space-y-3">
      <Ok text={state.ok} />
      <FormError message={e._form} />
      {status !== "active" && !suspending && (
        <form action={action}>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="status" value="active" />
          <SubmitButton className="w-full" pendingLabel="Validation…">
            {status === "en_attente" ? `Valider l'espace « ${orgName} »` : "Réactiver l'espace"}
          </SubmitButton>
        </form>
      )}
      {status !== "suspendue" &&
        (suspending ? (
          <form action={action} className="space-y-3 rounded-2xl bg-red-50 p-3 ring-1 ring-red-200">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="status" value="suspendue" />
            <Field label="Motif (affiché au client)" name="reason" error={e.reason}>
              <TextArea name="reason" rows={2} error={e.reason} placeholder="Ex. Compte non conforme, impayé…" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSuspending(false)} className={buttonStyles.secondary}>
                Annuler
              </button>
              <SubmitButton variant="danger" pendingLabel="…">
                Suspendre
              </SubmitButton>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setSuspending(true)} className={cx(buttonStyles.danger, "w-full")}>
            {status === "en_attente" ? "Refuser / suspendre" : "Suspendre l'espace"}
          </button>
        ))}
    </div>
  );
}

export function PlanForm({ orgId, plan }: { orgId: string; plan: string }) {
  const [state, action] = useActionState<AdminFormState, FormData>(setPlanAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orgId" value={orgId} />
      <div className="flex gap-2">
        <select name="plan" defaultValue={plan} className="input flex-1" aria-label="Formule">
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary" pendingLabel="…">
          OK
        </SubmitButton>
      </div>
      <Ok text={state.ok} />
    </form>
  );
}

export function NoteForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<AdminFormState, FormData>(addNoteAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orgId" value={orgId} />
      <TextArea name="note" rows={2} placeholder="Note interne (appel, relance, remarque…)" error={e.note} />
      {e.note && <p className="text-sm text-red-600">{e.note}</p>}
      <SubmitButton variant="secondary" className="w-full" pendingLabel="…">
        Ajouter la note
      </SubmitButton>
    </form>
  );
}
