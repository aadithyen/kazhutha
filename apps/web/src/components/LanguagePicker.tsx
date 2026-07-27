import en from "../i18n/locales/en.json";
import ml from "../i18n/locales/ml.json";
import type { LocaleId } from "../i18n/types";

const OPTIONS: { id: LocaleId; label: string; title: string; subtitle: string }[] = [
  {
    id: "en",
    label: en.meta.languageName,
    title: en.languagePicker.title,
    subtitle: en.languagePicker.subtitle,
  },
  {
    id: "ml",
    label: ml.meta.languageName,
    title: ml.languagePicker.title,
    subtitle: ml.languagePicker.subtitle,
  },
];

export default function LanguagePicker({ onSelect }: { onSelect: (locale: LocaleId) => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 bg-white px-4 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="text-center">
        <h1 className="font-serif text-4xl font-semibold italic">Kazhutha</h1>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{OPTIONS[0].subtitle}</p>
      </header>
      <div className="flex w-full flex-col gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className="rounded-xl border border-neutral-100 bg-white px-5 py-4 text-left shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.98] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
          >
            <span className="block font-serif text-2xl font-semibold italic">{option.label}</span>
            <span className="mt-1 block text-sm text-neutral-500 dark:text-neutral-400">{option.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
