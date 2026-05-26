import { AstroProvider } from "./context/AstroContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <AstroProvider>
      <AppRoutes />
    </AstroProvider>
  );
}
