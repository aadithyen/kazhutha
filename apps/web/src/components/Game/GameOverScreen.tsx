import { useNavigate } from "react-router-dom";
import { useLocale } from "../../i18n";
import { useRoom } from "../../lib/RoomContext";

export default function GameOverScreen() {
  const { t } = useLocale();
  const { state } = useRoom();
  const navigate = useNavigate();
  const kazhutha = state.players.find((p) => p.id === state.kazhuthaId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/95 px-6 text-center backdrop-blur-sm dark:bg-neutral-950/95">
      <span className="text-6xl">🐴</span>
      <h2 className="font-serif text-3xl font-semibold italic text-neutral-900 dark:text-neutral-100">
        {t("game.kazhuthaWins", { name: kazhutha?.name ?? t("common.someone") })}
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("game.everyoneEscaped")}</p>
      <button
        onClick={() => navigate("/", { replace: true })}
        className="mt-2 rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
      >
        {t("game.backHome")}
      </button>
    </div>
  );
}
