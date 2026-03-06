import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CoursePage } from './pages/CoursePage';
import { HomePage } from './pages/HomePage';
import { CoursesListPage } from './pages/CoursesListPage';
import { JourneyPage } from './pages/JourneyPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MindMapPage } from './pages/MindMapPage';
import { useAuthStore } from './stores/useAuthStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated());
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/courses/:id/mindmap" element={<ProtectedRoute><MindMapPage /></ProtectedRoute>} />
          <Route path="/courses/:id" element={<ProtectedRoute><CoursePage /></ProtectedRoute>} />
          <Route path="/courses" element={<ProtectedRoute><CoursesListPage /></ProtectedRoute>} />
          <Route path="/journeys/:id" element={<ProtectedRoute><JourneyPage /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
