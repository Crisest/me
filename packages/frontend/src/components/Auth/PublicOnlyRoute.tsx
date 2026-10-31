import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import { useGetUserQuery } from '@/services/authService';

/** Login/register only make sense signed out; signed-in users go where they were headed. */
export const PublicOnlyRoutes = () => {
  const { data: user, isLoading } = useGetUserQuery();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? RouteEnum.HOME;

  if (isLoading) return <div>Loading...</div>;
  if (user) return <Navigate to={from} replace />;
  return <Outlet />;
};
