import { SUIT_SYMBOLS } from "@kazhutha/shared";
import { useRoom } from "../../lib/RoomContext";

export default function TurnBanner() {
  const { state, client } = useRoom();
  const turnPlayer = state.players.find((p) => p.id === state.currentTurnId);
  const isMyTurn = state.currentTurnId === client.playerId;
  const vettu = state.lastRoundResult?.kind === "vettu" && Date.now() - state.lastRoundResult.at < 2000;

  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 font-serif text-sm italic">
      <span className={`font-semibold not-italic ${isMyTurn ? "text-neutral-900" : "text-neutral-500"}`}>
        {isMyTurn ? "Your turn" : turnPlayer ? `${turnPlayer.name}'s turn` : "Waiting…"}
      </span>
      <span className="flex items-center gap-2 text-neutral-400">
        {vettu && <span className="rounded bg-rose-50 px-2 py-0.5 font-bold not-italic text-rose-600">VETTU!</span>}
        {state.leadSuit && <span>Lead: {SUIT_SYMBOLS[state.leadSuit]}</span>}
      </span>
    </div>
  );
}
