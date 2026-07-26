import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { usePwaBackNavigation } from "./lib/usePwaBackNavigation";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";

function AppRoutes() {
  usePwaBackNavigation();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
