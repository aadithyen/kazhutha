export default function ConnectionBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-red-600 px-4 py-2 text-sm text-white">
      <span>{message}</span>
      <button onClick={onDismiss} className="rounded px-2 py-1 text-xs font-semibold hover:bg-red-700">
        Dismiss
      </button>
    </div>
  );
}
