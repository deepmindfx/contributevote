
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProviders } from "@/contexts/AppProviders";
import AppRoutes from "@/routes";

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProviders>
          <Toaster position="top-center" richColors />
          <AppRoutes />
        </AppProviders>
      </AuthProvider>
    </Router>
  );
}

export default App;
