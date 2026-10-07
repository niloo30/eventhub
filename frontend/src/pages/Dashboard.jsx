import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  const roleRoutes = {
    customer: '/dashboard/customer',
    organizer: '/dashboard/organizer',
    admin: '/dashboard/admin',
  };

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={roleRoutes[user.role] || '/'} replace />;
}
