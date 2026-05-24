import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { op } from "./lib/analytics";

op.init();

createRoot(document.getElementById("root")!).render(<App />);
