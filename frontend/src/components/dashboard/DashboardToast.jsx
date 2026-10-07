const toneClasses = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-yellow-600',
  info: 'bg-blue-600',
};

export default function DashboardToast({ toast }) {
  if (!toast?.open) return null;

  return (
    <div className={`fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-white shadow-lg ${toneClasses[toast.type] || toneClasses.info}`}>
      {toast.message}
    </div>
  );
}
