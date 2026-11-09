import { loadSettingsPage } from "@/lib/settings-page";
import { SettingsNav } from "@/components/settings-nav";

export default async function SettingsLayout({ children }: LayoutProps<"/reglages">) {
  const { issues } = await loadSettingsPage();
  const blocking: Record<string, number> = {};
  for (const i of issues) if (i.level === "bloquant") blocking[i.href] = (blocking[i.href] ?? 0) + 1;
  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <SettingsNav blocking={blocking} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
