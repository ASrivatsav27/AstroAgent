import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AstroChat from "../features/astro/AstroChat";
import ChatWindow from "../components/ChatWindow";
import CosmicReveal from "../components/CosmicReveal";
import { useAstro } from "../context/AstroContext";

function RevealRoute() {
  const { birthDetails } = useAstro();
  const [revealDone, setRevealDone] = useState(false);

  if (!birthDetails) {
    return <Navigate to="/" replace />;
  }
  if (revealDone) {
    return <Navigate to="/chat" replace />;
  }
  return <CosmicReveal onComplete={() => setRevealDone(true)} />;
}

function ChatRoute() {
  const { birthDetails } = useAstro();
  if (!birthDetails) {
    return <Navigate to="/" replace />;
  }
  return <ChatWindow />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AstroChat />} />
        <Route path="/reveal" element={<RevealRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
