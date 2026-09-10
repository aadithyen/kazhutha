import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "./i18n";
import { usePwaBackNavigation } from "./lib/usePwaBackNavigation";
import HomePage from "./pages/HomePage";
import HandOfferPreviewPage from "./pages/HandOfferPreviewPage";
import RoomPage from "./pages/RoomPage";

function AppRoutes() {
  usePwaBackNavigation();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      {import.meta.env.DEV && <Route path="/dev/hand-offer" element={<HandOfferPreviewPage />} />}
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
