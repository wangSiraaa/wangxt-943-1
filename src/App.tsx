import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import { useAuthStore } from "@/store/authStore";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import PlanList from "@/pages/PlanList";
import PlanCreate from "@/pages/PlanCreate";
import PlanDetail from "@/pages/PlanDetail";
import VoyageDetail from "@/pages/VoyageDetail";
import ShipList from "@/pages/ShipList";
import ShipDetail from "@/pages/ShipDetail";
import CrewList from "@/pages/CrewList";
import BerthList from "@/pages/BerthList";
import AlertCenter from "@/pages/AlertCenter";
import Statistics from "@/pages/Statistics";
import Inspections from "@/pages/Inspections";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-xl font-medium text-gray-300">{title}</h2>
        <p className="text-sm text-gray-500 mt-2">功能开发中...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/plans" element={<PlanList />} />
        <Route path="/plans/new" element={<PlanCreate />} />
        <Route path="/plans/:id" element={<PlanDetail />} />
        <Route path="/voyages/:id" element={<VoyageDetail />} />
        <Route path="/ships" element={<ShipList />} />
        <Route path="/ships/:id" element={<ShipDetail />} />
        <Route path="/crew" element={<CrewList />} />
        <Route path="/berths" element={<BerthList />} />
        <Route path="/alerts" element={<AlertCenter />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/inspections/new" element={<PlaceholderPage title="新建临检记录" />} />
        <Route path="/inspections/:id" element={<PlaceholderPage title="临检记录详情" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
