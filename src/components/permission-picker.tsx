"use client";

import { useState } from "react";
import { PERMISSION_GROUPS, PRESETS } from "@/lib/permissions";
import { cx } from "./ui";

/**
 * Cases à cocher des autorisations, avec profils rapides.
 * `grantable` : droits que l'utilisateur courant peut accorder (les autres sont grisés).
 */
export function PermissionPicker({ initial, grantable }: { initial: readonly string[]; grantable: readonly string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyPreset(perms: readonly string[]) {
    setSelected(new Set(perms.filter((p) => grantable.includes(p))));
  }

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">Autorisations</legend>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.permissions)}
            className="min-h-10 rounded-full bg-brand-50 px-3 text-sm font-bold text-brand-700 ring-1 ring-brand-100 active:bg-brand-100"
          >
            {p.label}
          </button>
        ))}
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} className="rounded-2xl bg-white ring-1 ring-slate-200">
          <p className="border-b border-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
            {group.label}
          </p>
          <ul>
            {group.permissions.map((perm) => {
              const allowed = grantable.includes(perm.key);
              return (
                <li key={perm.key}>
                  <label
                    className={cx(
                      "flex min-h-12 items-center gap-3 px-3 py-2 text-sm",
                      allowed ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="permissions"
                      value={perm.key}
                      checked={selected.has(perm.key)}
                      disabled={!allowed}
                      onChange={() => toggle(perm.key)}
                      className="size-5 shrink-0 accent-brand-600"
                    />
                    <span className="flex-1">
                      {perm.label}
                      {!perm.ready && <span className="ml-1.5 text-xs text-slate-400">(module à venir)</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
