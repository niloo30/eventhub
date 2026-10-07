const baseClassName =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default function DashboardStatCard({
  label,
  value,
  hint,
  onClick,
  actionLabel,
}) {
  const content = (
    <>
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</div> : null}
      {actionLabel ? (
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          {actionLabel}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClassName} text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}
