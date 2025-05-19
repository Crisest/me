import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import { useGetUserQuery } from '@/services/authService';

export const PrivateRoutes = () => {
  const { data: user, isLoading } = useGetUserQuery();
  const location = useLocation();
  const isAuthenticated = !!user;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Save the current attempted path, not the previous location
    return (
      <Navigate to={RouteEnum.LOGIN} state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
};
