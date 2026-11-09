"use client";

import { useActionState, useRef, useState } from "react";
import { saveSeriesAction, type SettingsState } from "@/app/(app)/reglages/actions";
import { formatDocNumber, nextCounter, localYearMonth, validatePattern, type DocType, type NumberReset } from "@/lib/numbering";
import { FormError, Icon, cx } from "../ui";
import { SubmitButton } from "../submit-button";
import { SavedNotice } from "../settings-ui";

const TOKENS = [
  { token: "{AAAA}", label: "Année" },
  { token: "{AA}", label: "Année (2 chiffres)" },
  { token: "{MM}", label: "Mois" },
  { token: "{N}", label: "Compteur" },
];

export function SeriesForm(props: {
  docType: DocType;
  label: string;
  pattern: string;
  padding: number;
  reset: NumberReset;
  lastNumber: number;
  lastYear: number | null;
  locked: boolean;
  timeZone: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSeriesAction, {});
  const [pattern, setPattern] = useState(props.pattern);
  const [padding, setPadding] = useState(props.padding);
  const [reset, setReset] = useState<NumberReset>(props.reset);
  const input = useRef<HTMLInputElement>(null);
  const now = new Date();
  const { year } = localYearMonth(now, props.timeZone);
  const error = validatePattern(pattern, padding, reset);
  const n = nextCounter({ lastNumber: props.lastNumber, lastYear: props.lastYear, reset }, year);
  const preview = error ? null : formatDocNumber(pattern, n, { padding, date: now, timeZone: props.timeZone });
  const nextYear = error || reset !== "annuel" ? null : formatDocNumber(pattern, 1, { padding, date: new Date(`${year + 1}-01-15T12:00:00Z`), timeZone: props.timeZone });

  function insert(token: string) {
    const el = input.current;
    if (!el) return setPattern((p) => p + token);
    const start = el.selectionStart ?? pattern.length;
    const end = el.selectionEnd ?? pattern.length;
    const next = pattern.slice(0, start) + token + pattern.slice(end);
    setPattern(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const serverError = state.errors?.pattern ?? state.errors?._form;

  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:p-5">
      <input type="hidden" name="docType" value={props.docType} />
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold">{props.label}</h3>
        <p className="text-sm text-slate-500">
          Prochain : <strong className="font-mono text-[15px] text-ink" data-testid={`preview-${props.docType}`}>{preview ?? "—"}</strong>
        </p>
      </div>

      {props.locked ? (
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Icon name="key" className="mt-0.5 size-4 shrink-0" />
          Format verrouillé : des documents ont déjà été numérotés avec « {props.pattern} ». Il ne peut plus changer, pour garantir
          une suite continue.
        </p>
      ) : (
        <>
          <SavedNotice text={state.ok} />
          <FormError message={serverError} />
          <div>
            <label htmlFor={`pattern-${props.docType}`} className="mb-1.5 block text-sm font-bold text-slate-700">
              Format
            </label>
            <input
              ref={input}
              id={`pattern-${props.docType}`}
              name="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="input font-mono"
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insert(t.token)}
                  className="min-h-9 rounded-full bg-slate-100 px-3 text-sm text-slate-700 hover:bg-slate-200"
                >
                  <span className="font-mono">{t.token}</span> {t.label}
                </button>
              ))}
            </div>
            {error && <p className="mt-1.5 text-sm font-bold text-red-600">{error}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Chiffres du compteur</span>
              <select name="padding" value={padding} onChange={(e) => setPadding(Number(e.target.value))} className="input">
                {[3, 4, 5, 6].map((p) => (
                  <option key={p} value={p}>
                    {p} ({"0".repeat(p - 1)}1)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Compteur</span>
              <select name="resetPolicy" value={reset} onChange={(e) => setReset(e.target.value as NumberReset)} className="input">
                <option value="annuel">Repart à 1 chaque année</option>
                <option value="jamais">Continue sans fin</option>
              </select>
            </label>
          </div>
          {nextYear && <p className="text-sm text-slate-500">Premier numéro de l&apos;an prochain : <span className="font-mono">{nextYear}</span></p>}
          <SubmitButton variant="secondary" className={cx(error && "pointer-events-none opacity-50")}>
            Enregistrer le format
          </SubmitButton>
        </>
      )}
    </form>
  );
}
