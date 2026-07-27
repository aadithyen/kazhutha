import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../LanguageSwitcher";
import { useLocale } from "../../i18n";
import { useRoom } from "../../lib/RoomContext";
import InvitePanel from "./InvitePanel";
import PlayerList from "./PlayerList";
import RulesPanel from "./RulesPanel";

export default function LobbyScreen() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { state, client } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;
  const connectedPlayers = state.players.filter((p) => p.connected);
  const allReady = connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.ready);

  function toggleReady() {
    client.sendIntent({ type: "SetReady", playerId: client.playerId, ready: !me?.ready });
  }

  function startGame() {
    client.sendIntent({ type: "StartGame", playerId: client.playerId });
  }

  function exitLobby() {
    client.leave();
    navigate("/", { replace: true });
  }

  return (
    <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <button
        type="button"
        onClick={exitLobby}
        className="absolute left-0 top-0 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {t("lobby.exitLobby")}
      </button>
      <LanguageSwitcher className="absolute right-0 top-0" />
      <header className="text-center">
        <h1 className="font-serif text-3xl font-semibold italic text-neutral-900 dark:text-neutral-100">
          {t("lobby.title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t("lobby.subtitle")}</p>
      </header>
      <InvitePanel />
      <PlayerList />
      <RulesPanel />

      <div className="sticky bottom-0 mt-2 flex gap-2 border-t border-neutral-100 bg-white/90 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button
          onClick={toggleReady}
          className={`flex-1 rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
            me?.ready
              ? "bg-neutral-900 text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
              : "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700"
          }`}
        >
          {me?.ready ? t("lobby.readyDone") : t("lobby.readyAction")}
        </button>
        {isHost && (
          <button
            onClick={startGame}
            disabled={!allReady}
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 text-base font-semibold text-white shadow-[0_2px_12px_rgba(15,23,42,0.12)] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)] dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          >
            {allReady
              ? t("lobby.startGame")
              : t("lobby.waiting", {
                  ready: connectedPlayers.filter((p) => p.ready).length,
                  total: connectedPlayers.length,
                })}
          </button>
        )}
      </div>
    </div>
  );
}
