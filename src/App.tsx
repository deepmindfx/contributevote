
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AppRoutes from "@/routes";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
