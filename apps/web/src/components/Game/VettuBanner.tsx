import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n";
import { pickRandomVettuMessage } from "../../lib/vettuMessages";
import { useRoom } from "../../lib/RoomContext";

const ENTER_MS = 500;
const HOLD_MS = 500;
const EXIT_MS = 500;

type Phase = "idle" | "enter" | "hold" | "exit";

export default function VettuBanner() {
  const { vettuMessages } = useLocale();
  const { state } = useRoom();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const lastVettuAtRef = useRef<number | null>(null);

  useEffect(() => {
    const result = state.lastRoundResult;
    if (result?.kind !== "vettu") return;
    if (lastVettuAtRef.current === result.at) return;
    lastVettuAtRef.current = result.at;

    setMessage(pickRandomVettuMessage(vettuMessages));
    setPhase("enter");

    const holdTimer = window.setTimeout(() => setPhase("hold"), ENTER_MS);
    const exitTimer = window.setTimeout(() => setPhase("exit"), ENTER_MS + HOLD_MS);
    const idleTimer = window.setTimeout(() => setPhase("idle"), ENTER_MS + HOLD_MS + EXIT_MS);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(idleTimer);
    };
  }, [state.lastRoundResult, vettuMessages]);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-live="assertive">
      <div
        className={`vettu-dim absolute inset-0 bg-black/40 ${
          phase === "enter" ? "vettu-dim-enter" : phase === "exit" ? "vettu-dim-exit" : "opacity-100"
        }`}
        style={{
          animationDuration: phase === "enter" ? `${ENTER_MS}ms` : phase === "exit" ? `${EXIT_MS}ms` : undefined,
        }}
      />
      <div
        className={`vettu-banner relative w-full bg-white px-6 py-4 text-center font-bold tracking-wide text-neutral-900 shadow-lg ${
          phase === "enter" ? "vettu-banner-enter" : phase === "exit" ? "vettu-banner-exit" : ""
        }`}
        style={{
          animationDuration: phase === "enter" ? `${ENTER_MS}ms` : phase === "exit" ? `${EXIT_MS}ms` : undefined,
        }}
      >
        <span className="vettu-banner-text block text-balance">{message}</span>
      </div>
    </div>
  );
}
