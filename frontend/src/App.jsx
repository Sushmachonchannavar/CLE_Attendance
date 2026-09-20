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
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user && user.role?.toLowerCase() === 'admin' ? children : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LocationTracker />
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
