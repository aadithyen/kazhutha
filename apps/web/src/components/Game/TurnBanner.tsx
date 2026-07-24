import { SUIT_SYMBOLS } from "@kazhutha/shared";
import { useRoom } from "../../lib/RoomContext";

export default function TurnBanner() {
  const { state, client } = useRoom();
  const turnPlayer = state.players.find((p) => p.id === state.currentTurnId);
  const isMyTurn = state.currentTurnId === client.playerId;
  const vettu = state.lastRoundResult?.kind === "vettu" && Date.now() - state.lastRoundResult.at < 2000;

  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <span className={`font-semibold ${isMyTurn ? "text-amber-400" : "text-slate-300"}`}>
        {isMyTurn ? "Your turn" : turnPlayer ? `${turnPlayer.name}'s turn` : "Waiting…"}
      </span>
      <span className="flex items-center gap-2 text-slate-400">
        {vettu && <span className="rounded bg-red-500/20 px-2 py-0.5 font-bold text-red-300">VETTU!</span>}
        {state.leadSuit && <span>Lead: {SUIT_SYMBOLS[state.leadSuit]}</span>}
      </span>
    </div>
  );
}
