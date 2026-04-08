import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import TicketChatPage from './pages/TicketChatPage';

// Protected Route — only logged in users
const ProtectedRoute = ({ children }) => {
    const { token } = useAuth();
    return token ? children : <Navigate to="/login" />;
};


// Admin Route — only admin users
const AdminRoute = ({ children }) => {
    const { token } = useAuth();
    if (!token) return <Navigate to="/login" />;
    const role = localStorage.getItem('role');
    if (role !== 'ADMIN') return <Navigate to="/chat" />;
    return children;
};

const AppRoutes = () => {
  return (
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Customer Route */}
        <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
        />

        {/* Admin Routes */}
        <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
        />
        <Route
            path="/admin/tickets/:id"
            element={
              <AdminRoute>
                <TicketChatPage />
              </AdminRoute>
            }
        />
        <Route
            path="/analytics"
            element={
              <AdminRoute>
                <AnalyticsPage />
              </AdminRoute>
            }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
  );
};

const App = () => {
  return (
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
  );
};

export default App;