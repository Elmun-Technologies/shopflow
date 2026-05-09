import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MiniApp from "./miniapp/MiniApp";

const isMiniApp = typeof window !== "undefined" && window.location.pathname.startsWith("/mini/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isMiniApp ? <MiniApp /> : <App />}
  </StrictMode>,
);
