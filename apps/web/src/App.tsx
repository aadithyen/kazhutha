import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import UpdateBanner from "./components/UpdateBanner";
import { LocaleProvider } from "./i18n";
import { registerPwaUpdate } from "./lib/pwaUpdate";
import { usePwaBackNavigation } from "./lib/usePwaBackNavigation";
import { startVersionCheck } from "./lib/versionCheck";
import LandingPage from "./pages/LandingPage";
import PlayPage from "./pages/PlayPage";
import RoomPage from "./pages/RoomPage";

function AppRoutes() {
  usePwaBackNavigation();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppShell() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const reloadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    registerPwaUpdate((reload) => {
      setUpdateAvailable(true);
      reloadRef.current = reload;
    });

    return startVersionCheck(() => {
      setUpdateAvailable(true);
      reloadRef.current = () => location.reload();
    });
  }, []);

  return (
    <>
      {updateAvailable && (
        <UpdateBanner
          onReload={() => {
            (reloadRef.current ?? (() => location.reload()))();
          }}
        />
      )}
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </LocaleProvider>
  );
}
