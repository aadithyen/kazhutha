import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function isAppShellEmpty(): boolean {
  const root = document.getElementById("root");
  return !root || root.childElementCount === 0;
}

/**
 * PWA standalone launch can leave a phantom history entry before the app URL.
 * Back from home then shows an empty shell (grey page) instead of exiting.
 */
export function usePwaBackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const recoveryAttemptsRef = useRef(0);

  useEffect(() => {
    if (location.pathname !== "/") return;
    const state = window.history.state;
    if (!state?.kazhuthaHome) {
      window.history.replaceState({ ...state, kazhuthaHome: true }, "");
    }
  }, [location.pathname]);

  useEffect(() => {
    const onPopState = () => {
      // Defer past React Router route swap.
      setTimeout(() => {
        if (!isAppShellEmpty()) {
          recoveryAttemptsRef.current = 0;
          return;
        }

        const path = window.location.pathname;
        if (path.startsWith("/room/")) {
          navigate(path + window.location.search + window.location.hash, { replace: true });
          return;
        }

        if (path !== "/" && path !== "") {
          navigate("/", { replace: true });
          return;
        }

        if (recoveryAttemptsRef.current < 2 && window.history.length > 1) {
          recoveryAttemptsRef.current += 1;
          window.history.back();
          return;
        }

        recoveryAttemptsRef.current = 0;
        navigate("/", { replace: true });
      }, 0);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);
}
