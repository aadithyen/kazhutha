import { RULE_FIELD_DEFS } from "@kazhutha/game";
import { useRoom } from "../../lib/RoomContext";

export default function RulesPanel() {
  const { state, client } = useRoom();
  const me = state.players.find((p) => p.id === client.playerId);
  const isHost = me?.isHost ?? false;

  function toggle(key: keyof typeof state.rules) {
    if (!isHost) return;
    client.sendIntent({
      type: "ChangeRules",
      playerId: client.playerId,
      rules: { ...state.rules, [key]: !state.rules[key] },
    });
  }

  return (
    <div className="rounded-2xl bg-slate-800/60 p-4 shadow-lg">
      <p className="mb-2 text-xs uppercase text-slate-400">Rules</p>
      <ul className="flex flex-col gap-2">
        {RULE_FIELD_DEFS.map((field) => (
          <li key={field.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{field.label}</p>
              <p className="text-xs text-slate-500">{field.description}</p>
            </div>
            <button
              onClick={() => toggle(field.key)}
              disabled={!isHost}
              className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                state.rules[field.key] ? "bg-amber-400" : "bg-slate-600"
              } ${!isHost ? "opacity-50" : ""}`}
            >
              <span
                className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${
                  state.rules[field.key] ? "translate-x-5" : ""
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
