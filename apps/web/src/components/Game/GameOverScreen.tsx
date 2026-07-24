import { useNavigate } from "react-router-dom";
import { useRoom } from "../../lib/RoomContext";

export default function GameOverScreen() {
  const { state } = useRoom();
  const navigate = useNavigate();
  const kazhutha = state.players.find((p) => p.id === state.kazhuthaId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/95 px-6 text-center">
      <span className="text-6xl">🐴</span>
      <h2 className="text-2xl font-bold text-amber-400">{kazhutha?.name ?? "Someone"} is the Kazhutha!</h2>
      <p className="text-sm text-slate-400">Everyone else escaped. Better luck next round.</p>
      <button
        onClick={() => navigate("/")}
        className="mt-2 rounded-lg bg-amber-400 px-6 py-3 font-semibold text-slate-900"
      >
        Back home
      </button>
    </div>
  );
}
