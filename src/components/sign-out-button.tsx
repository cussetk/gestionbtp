"use client";

import { signOutAction } from "@/app/(public)/actions";
import { clearOfflineCache } from "./service-worker";
import { Icon } from "./ui";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        await clearOfflineCache();
        await signOutAction();
      }}
    >
      <button
        type="submit"
        aria-label="Se déconnecter"
        className="grid size-11 place-items-center rounded-full text-white/90 active:bg-white/15"
      >
        <Icon name="logout" />
      </button>
    </form>
  );
}
