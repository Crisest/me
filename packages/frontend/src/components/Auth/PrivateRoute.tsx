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
    // Save the full attempted URL (path, query, hash); replace so Back skips the guard
    return (
      <Navigate
        to={RouteEnum.LOGIN}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  return <Outlet />;
};
