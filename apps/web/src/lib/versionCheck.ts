import { getAppVersion } from "./appVersion";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function startVersionCheck(onStale: () => void): () => void {
  if (import.meta.env.DEV) return () => {};

  const localVersion = getAppVersion();
  let stopped = false;

  async function check() {
    if (stopped) return;
    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data.version && data.version !== localVersion) onStale();
    } catch {
      // Best-effort; ignore transient network failures.
    }
  }

  void check();
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  const onVisibility = () => {
    if (document.visibilityState === "visible") void check();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    stopped = true;
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
