import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leaves from './pages/Leaves';
import OD from './pages/OD';
import Reports from './pages/Reports';
import Register from './pages/Register';
import LeaveRequests from './pages/LeaveRequests';
import ODRequests from './pages/ODRequests';
import Profile from './pages/Profile';
import Attendance from './pages/Attendance';
import LocationTracking from './pages/LocationTracking';
import LocationTracker from './components/LocationTracker';
import DownloadApp from './pages/DownloadApp';
import LoadingScreen from './components/LoadingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

/**
 * Route guard that requires active authentication.
 * Protects dashboards and resources; redirects unauthenticated visitors to /login with replace.
 */
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Restoring secure session..." />;
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * Route guard specifically for guest-only pages (e.g. /login, /register).
 * Protects against browser Back navigation into login while a valid session exists.
 * Redirects authenticated users directly to their appropriate dashboard with replace.
 */
const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Verifying session..." />;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

/**
 * Route guard that restricts administrative portals (live map tracking) to admin accounts only.
 */
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Verifying administrator access..." />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role?.toLowerCase() === 'admin' ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LocationTracker />
        <BrowserRouter>
        <Routes>
          <Route path="/download" element={<DownloadApp />} />
          <Route path="/install" element={<DownloadApp />} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <PrivateRoute>
                <Attendance />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/leaves"
            element={
              <PrivateRoute>
                <Leaves />
              </PrivateRoute>
            }
          />
          <Route
            path="/od"
            element={
              <PrivateRoute>
                <OD />
              </PrivateRoute>
            }
          />
          <Route
            path="/leave-requests"
            element={
              <PrivateRoute>
                <LeaveRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/staff-leave-requests"
            element={
              <PrivateRoute>
                <LeaveRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/od-requests"
            element={
              <PrivateRoute>
                <ODRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/staff-od-requests"
            element={
              <PrivateRoute>
                <ODRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <Reports />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/tracking"
            element={
              <AdminRoute>
                <LocationTracking />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
