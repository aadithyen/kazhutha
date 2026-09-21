import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n";
<<<<<<< HEAD
import { getVettuMessageByIndex } from "../../lib/vettuMessages";
=======
import { usePlayerAvatars } from "../../lib/PlayerAvatarContext";
import { pickRandomVettuMessage } from "../../lib/vettuMessages";
>>>>>>> origin/main
import { useRoom } from "../../lib/RoomContext";
import { ROUND_LINGER_MS } from "./CardAnimations";

const ENTER_MS = 500;
const EXIT_MS = 500;
/** Collect flight after linger; keep banner through pile settle if pileSettling never flips. */
const SETTLEMENT_FALLBACK_MS = ROUND_LINGER_MS + 500;

type Phase = "idle" | "enter" | "hold" | "exit";

export default function VettuBanner() {
  const { t, vettuMessages } = useLocale();
  const { state } = useRoom();
  const { pileSettling } = usePlayerAvatars();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  // Joining mid-game inherits the host's last result; don't announce an old vettu.
  const lastVettuAtRef = useRef<number | null>(
    state.lastRoundResult?.kind === "vettu" ? state.lastRoundResult.at : null,
  );
  const holdStartedAtRef = useRef<number | null>(null);
  const sawPileSettlingRef = useRef(false);

  useEffect(() => {
    const result = state.lastRoundResult;
    if (result?.kind !== "vettu") return;
    if (lastVettuAtRef.current === result.at) return;
    lastVettuAtRef.current = result.at;

<<<<<<< HEAD
    setMessage(
      result.statementIndex !== undefined
        ? getVettuMessageByIndex(vettuMessages, result.statementIndex)
        : "",
    );
=======
    setMessage(pickRandomVettuMessage(vettuMessages));
    holdStartedAtRef.current = null;
    sawPileSettlingRef.current = false;
>>>>>>> origin/main
    setPhase("enter");

    const holdTimer = window.setTimeout(() => {
      holdStartedAtRef.current = Date.now();
      setPhase("hold");
    }, ENTER_MS);

    return () => {
      window.clearTimeout(holdTimer);
    };
  }, [state.lastRoundResult, vettuMessages]);

  useEffect(() => {
    if (phase !== "hold" || !pileSettling) return;
    sawPileSettlingRef.current = true;
  }, [phase, pileSettling]);

  useEffect(() => {
    if (phase !== "hold") return;
    if (pileSettling) return;

    if (sawPileSettlingRef.current) {
      setPhase("exit");
      return;
    }

    const holdStartedAt = holdStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - holdStartedAt;
    const remainingFallback = Math.max(0, SETTLEMENT_FALLBACK_MS - elapsed);

    const exitTimer = window.setTimeout(() => setPhase("exit"), remainingFallback);
    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [phase, pileSettling]);

  useEffect(() => {
    if (phase !== "exit") return;
    const idleTimer = window.setTimeout(() => setPhase("idle"), EXIT_MS);
    return () => {
      window.clearTimeout(idleTimer);
    };
  }, [phase]);

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
        className={`vettu-banner relative w-full bg-white px-6 py-4 text-center tracking-wide text-neutral-900 shadow-lg ${
          phase === "enter" ? "vettu-banner-enter" : phase === "exit" ? "vettu-banner-exit" : ""
        }`}
        style={{
          animationDuration: phase === "enter" ? `${ENTER_MS}ms` : phase === "exit" ? `${EXIT_MS}ms` : undefined,
        }}
      >
        <span className="vettu-banner-title block text-balance">{t("vettu.title")}</span>
        {message && (
          <>
            <span className="vettu-banner-divider" aria-hidden="true" />
            <span className="vettu-banner-sub block text-balance">{message}</span>
          </>
        )}
      </div>
    </div>
  );
}
