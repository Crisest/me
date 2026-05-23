import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import LoginPage from '@/modules/Auth/Login/LoginPage';
import RegisterPage from '@/modules/Auth/register/RegisterPage';
import SharedPage from '@/modules/shared/SharedPage';
import SharedDashboardPage from '@/modules/shared/SharedDashboardPage';
import JoinSharedPage from '@/modules/shared/JoinSharedPage';
import { BudgetPage } from '@/modules/budget/BudgetPage';
import { ProfilePage } from '@/modules/profile/ProfilePage';
import { PrivateRoutes } from '@/components/Auth/PrivateRoute';
import AppLayout from '@/components/Layout/AppLayout';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path={RouteEnum.LOGIN} element={<LoginPage />} />
      <Route path={RouteEnum.REGISTER} element={<RegisterPage />} />

      {/* Protected routes */}
      <Route element={<PrivateRoutes />}>
        <Route element={<AppLayout />}>
          <Route path={RouteEnum.HOME} element={<BudgetPage />} />
          <Route path={RouteEnum.BUDGET} element={<BudgetPage />} />
          <Route path={RouteEnum.PROFILE} element={<ProfilePage />} />
          <Route path={RouteEnum.SHARED} element={<SharedPage />} />
          <Route path={RouteEnum.SHARED_JOIN} element={<JoinSharedPage />} />
          <Route
            path={RouteEnum.SHARED_DASHBOARD}
            element={<SharedDashboardPage />}
          />
        </Route>
      </Route>
    </Routes>
  );
};
