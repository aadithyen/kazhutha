import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "./i18n";
import { usePwaBackNavigation } from "./lib/usePwaBackNavigation";
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

export default function App() {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LocaleProvider>
  );
}
