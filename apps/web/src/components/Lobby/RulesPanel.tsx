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
    <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Rules</p>
      <ul className="flex flex-col gap-3">
        {RULE_FIELD_DEFS.map((field) => (
          <li key={field.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">{field.label}</p>
              <p className="text-xs text-neutral-500">{field.description}</p>
            </div>
            <button
              onClick={() => toggle(field.key)}
              disabled={!isHost}
              className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                state.rules[field.key] ? "bg-neutral-900" : "bg-neutral-200"
              } ${!isHost ? "opacity-50" : ""}`}
            >
              <span
                className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform ${
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
