import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext.jsx';

function AdminProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        color: '#174D35'
      }}>
        Verifying Admin Access...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default AdminProtectedRoute;
