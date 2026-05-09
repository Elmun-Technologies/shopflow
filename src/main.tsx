import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MiniApp from "./miniapp/MiniApp";
import AuthGate from "./components/AuthGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotificationsProvider } from "./lib/notifications";

const isMiniApp = typeof window !== "undefined" && window.location.pathname.startsWith("/mini/");

function Root() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <AuthGate onAuthed={() => setAuthed(true)} />;
  return <NotificationsProvider><App /></NotificationsProvider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isMiniApp ? <MiniApp /> : <Root />}
    </ErrorBoundary>
  </StrictMode>,
);
