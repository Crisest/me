import { Navigate, Outlet } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import { useAuth } from '@/hooks/useAuth';

export const PrivateRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={RouteEnum.LOGIN} />;
};
