export default function ConnectionBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
      >
        Dismiss
      </button>
    </div>
  );
}
