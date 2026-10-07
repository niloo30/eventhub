export default function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-outline" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn" onClick={onConfirm} type="button">
            Confirm rollout
          </button>
        </div>
      </div>
    </div>
  );
}
