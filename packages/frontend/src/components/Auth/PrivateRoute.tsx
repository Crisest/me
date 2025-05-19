import { Navigate, Outlet } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import { useGetUserQuery } from '@/services/authService';

export const PrivateRoutes = () => {
  const { data: user, isLoading } = useGetUserQuery();
  const isAuthenticated = !!user;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={RouteEnum.LOGIN} />;
};
