import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import AnalyzePage from "./pages/AnalyzePage.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/analyses" element={<HistoryPage />} />
          <Route path="/analyses/:id" element={<AnalysisPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
