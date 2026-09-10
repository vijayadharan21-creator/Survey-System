import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './login.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import SurveyerDashboard from './pages/SurveyerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import PublicSurvey from './pages/PublicSurvey.jsx';

// Redirect /dashboard → role-specific dashboard
function DashboardRedirect() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role === 'ADMIN') return <Navigate to="/dashboard/admin" replace />;
  if (user.role === 'SURVEYER') {
    return <Navigate to="/dashboard/surveyer" replace />;
  }
  return <Navigate to="/dashboard/user" replace />;
}

// Protect a route: requires login + specific role
function RoleRoute({ role, children }) {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    if (user.role === 'ADMIN')    return <Navigate to="/dashboard/admin"    replace />;
    if (user.role === 'SURVEYER') return <Navigate to="/dashboard/surveyer" replace />;
    return <Navigate to="/dashboard/user" replace />;
  }
  return children;
}

// Protect a route: requires login (any role)
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Role-based dashboards */}
          <Route
            path="/dashboard/user"
            element={
              <RoleRoute role="USER">
                <UserDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/surveyer"
            element={
              <RoleRoute role="SURVEYER">
                <SurveyerDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <RoleRoute role="ADMIN">
                <AdminDashboard />
              </RoleRoute>
            }
          />

          {/* Generic /dashboard → redirect based on role */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardRedirect />
              </PrivateRoute>
            }
          />

          {/* Public survey participation link — no login required */}
          <Route path="/survey/:surveyId" element={<PublicSurvey />} />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
