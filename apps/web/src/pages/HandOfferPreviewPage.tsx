import HandOfferPromptView, {
  previewHandOffer,
  previewPlayers,
} from "../components/Game/HandOfferPromptView";
import { useLocale } from "../i18n";

function PreviewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex w-[390px] flex-col overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-950">
      <div className="border-b border-neutral-100 px-4 py-3 text-center text-sm font-semibold text-neutral-700 dark:border-neutral-800 dark:text-neutral-200">
        {title}
      </div>
      <div className="relative flex min-h-[720px] flex-col bg-white dark:bg-neutral-950">
        <div className="flex-1 bg-neutral-50 dark:bg-neutral-900" />
        <div className="h-48 bg-white dark:bg-neutral-950" />
        <div className="absolute inset-x-0 bottom-24 px-4">{children}</div>
      </div>
    </div>
  );
}

export default function HandOfferPreviewPage() {
  const { t } = useLocale();

  return (
    <div className="min-h-dvh bg-neutral-100 px-6 py-10 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Hand offer prompts</h1>
        <div className="flex flex-wrap items-start justify-center gap-8">
          <PreviewFrame title="Offerer (Bob)">
            <HandOfferPromptView
              offer={previewHandOffer("awaiting_offer")}
              playerId="bob"
              players={previewPlayers}
              t={t}
              className="relative mx-auto w-full max-w-md"
            />
          </PreviewFrame>
          <PreviewFrame title="Recipient (Alice)">
            <HandOfferPromptView
              offer={previewHandOffer("awaiting_response")}
              playerId="alice"
              players={previewPlayers}
              t={t}
              className="relative mx-auto w-full max-w-md"
            />
          </PreviewFrame>
        </div>
      </div>
    </div>
  );
}
