import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { Icon } from "@/components/ui";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-md">
          <Icon name="drop" className="size-8" />
        </div>
        <p className="text-2xl font-bold tracking-tight">{APP_NAME}</p>
        <p className="mt-1 text-sm text-slate-500">{APP_TAGLINE}</p>
      </div>
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">{children}</div>
    </main>
  );
}
