import { useLocale } from "../../i18n";
import { useRoom } from "../../lib/RoomContext";

export default function PlayerList() {
  const { t } = useLocale();
  const { state, client, peers, signalingConnected } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;
  const joined = !!me;
  const syncedIds = new Set(state.players.map((p) => p.id));
  // Peers the signaling server knows about but whose WebRTC link / state sync
  // hasn't completed yet — shown as placeholders while ICE works.
  const pendingPeers = peers.filter((p) => !syncedIds.has(p.id) && p.status !== "disconnected");

  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {t("lobby.players", { count: state.players.length + pendingPeers.length })}
      </p>
      {(state.players.length > 0 || pendingPeers.length > 0) && (
        <ul className="flex flex-col gap-2">
          {state.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${p.connected ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"}`}
                />
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{p.name}</span>
                {p.isHost && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    {t("common.host")}
                  </span>
                )}
                {p.id === client.playerId && (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">{t("common.you")}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${p.ready ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-400 dark:text-neutral-500"}`}
                >
                  {p.ready ? t("common.ready") : t("common.notReady")}
                </span>
                {isHost && p.id !== client.playerId && (
                  <button
                    onClick={() => client.sendIntent({ type: "KickPlayer", playerId: client.playerId, target: p.id })}
                    className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-900 dark:hover:bg-rose-900"
                  >
                    {t("lobby.kick")}
                  </button>
                )}
              </div>
            </li>
          ))}
          {pendingPeers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 ring-1 ring-neutral-100 opacity-80 dark:bg-neutral-800 dark:ring-neutral-700"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                <span className="font-medium text-neutral-500 dark:text-neutral-400">{p.name}</span>
              </div>
              <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                {t("lobby.connecting")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!joined && (
        <div
          className={`flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 ${
            state.players.length + pendingPeers.length > 0 ? "mt-3" : ""
          }`}
          role="status"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200" />
          <span>{signalingConnected ? t("lobby.findingPlayers") : t("lobby.connecting")}</span>
        </div>
      )}
    </div>
  );
}
