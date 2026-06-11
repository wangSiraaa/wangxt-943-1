import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import VoyagePlans from './pages/VoyagePlans';
import CrewVerification from './pages/CrewVerification';
import VoyageDetail from './pages/VoyageDetail';
import Dashboard from './pages/Dashboard';
import SupervisorOverview from './pages/SupervisorOverview';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="plans" element={<VoyagePlans />} />
        <Route path="verify" element={<CrewVerification />} />
        <Route path="supervisor" element={<SupervisorOverview />} />
        <Route path="voyages/:id" element={<VoyageDetail />} />
      </Route>
    </Routes>
  );
}
