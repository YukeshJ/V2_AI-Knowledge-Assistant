import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectManagerDashboard from "./pages/ProjectManagerDashboard";
import PMChatPage from "./pages/PMChatPage";
import TLChatPage from "./pages/TLChatPage";
import SDChatPage from "./pages/SDChatPage";
import JDChatPage from "./pages/JDChatPage";
import { useAuth } from "./context/AuthContext";
import { userApi } from "./services/api";

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      userApi.pingActive().catch(() => {});
      const interval = setInterval(() => {
        userApi.pingActive().catch(() => {});
      }, 60000); // 1 min ping
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<LoginPage />} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardPage />
          </ProtectedRoute>
        }/>

        {/* Project Manager Routes */}
        <Route path="/pm" element={<Navigate to="/pm/chat" replace />} />
        <Route path="/pm/chat" element={
          <ProtectedRoute allowedRoles={["Project Manager"]}>
            <PMChatPage />
          </ProtectedRoute>
        }/>
        <Route path="/pm/manage" element={
          <ProtectedRoute allowedRoles={["Project Manager"]}>
            <ProjectManagerDashboard />
          </ProtectedRoute>
        }/>


        {/* Team Member Routes */}
        <Route path="/tl" element={
          <ProtectedRoute allowedRoles={["Team Leader"]}>
            <TLChatPage />
          </ProtectedRoute>
        }/>

        <Route path="/sd" element={
          <ProtectedRoute allowedRoles={["Senior Developer"]}>
            <SDChatPage />
          </ProtectedRoute>
        }/>

        {/* Junior Developer Workspace */}
        <Route path="/jd" element={
          <ProtectedRoute allowedRoles={["Junior Developer"]}>
            <JDChatPage />
          </ProtectedRoute>
        }/>
      </Routes>
    </>
  );
}