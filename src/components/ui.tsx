/** Briques d'interface (composants serveur ou client, sans état). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Icônes (traits simples, 24 px) ─────────────────────────────────────────

const paths = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  plus: "M12 5v14M5 12h14",
  back: "M15 18l-6-6 6-6",
  chevron: "M9 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  box: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  building: "M4 21V5l8-2v18M12 7l8 2v12M8 9h1M8 13h1M8 17h1M15 12h2M15 16h2M3 21h18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  key: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1",
  locate: "M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
  menu: "M4 7h16M4 12h16M4 17h16",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  copy: "M8 8h11v11H8zM5 16V5h11",
  whatsapp: "M4 20l1.3-3.8A8 8 0 1 1 8 19zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  badge: "M4 6h16v13H4zM9 3h6v3H9zM9 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0M7 17c.6-1.8 2-2.5 4-2.5s3.4.7 4 2.5",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// ─── Mise en page ───────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  primary,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
  /** Action principale de la page, affichée en bouton sur ordinateur (sur téléphone : bouton flottant). */
  primary?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-start gap-2 lg:mb-6">
      {back && (
        <Link
          href={back}
          aria-label="Retour"
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-200/60 active:bg-slate-200"
        >
          <Icon name="back" className="size-6" />
        </Link>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="text-xl font-bold leading-tight break-words lg:text-[26px]">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-slate-500 lg:text-[15px]">{subtitle}</div>}
      </div>
      {action}
      {primary && (
        <span className="hidden lg:block">
          <Link href={primary.href} className={buttonStyles.primary}>
            <Icon name="plus" className="size-5" /> {primary.label}
          </Link>
        </span>
      )}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70", className)}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-bold text-slate-700">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

// ─── Boutons et liens ───────────────────────────────────────────────────────

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition active:scale-[0.98] disabled:opacity-60";
export const buttonStyles = {
  primary: cx(buttonBase, "bg-brand-600 text-white shadow-sm active:bg-brand-700"),
  secondary: cx(buttonBase, "bg-white text-ink ring-1 ring-slate-300 active:bg-slate-100"),
  danger: cx(buttonBase, "bg-white text-red-700 ring-1 ring-red-200 active:bg-red-50"),
  ghost: cx(buttonBase, "text-brand-700 active:bg-brand-50"),
  whatsapp: cx(buttonBase, "bg-[#1f8f4e] text-white shadow-sm active:bg-[#18733e]"),
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link {...props} className={cx(buttonStyles[variant], className)} />;
}

/** Bouton d'action rond en bas à droite (au-dessus de la barre de navigation). */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-600 pl-4 pr-5 font-bold text-white shadow-lg shadow-brand-900/25 active:bg-brand-700 lg:hidden"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <Icon name="plus" className="size-6" />
      {label}
    </Link>
  );
}

/** Ligne d'action (appeler, écrire, itinéraire…) : grande zone tactile. */
export function ActionRow({
  href,
  icon,
  children,
  hint,
  external,
}: {
  href: string;
  icon: IconName;
  children: ReactNode;
  hint?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 active:bg-slate-100"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words">{children}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </a>
  );
}

// ─── Formulaires ────────────────────────────────────────────────────────────

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({
  name,
  error,
  ...props
}: ComponentProps<"input"> & { name: string; error?: string }) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className="input"
      {...props}
    />
  );
}

export function TextArea({
  name,
  error,
  ...props
}: ComponentProps<"textarea"> & { name: string; error?: string }) {
  return (
    <textarea
      id={name}
      name={name}
      rows={3}
      aria-invalid={error ? true : undefined}
      className="input"
      {...props}
    />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
      {message}
    </p>
  );
}
