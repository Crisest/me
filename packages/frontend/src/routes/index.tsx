import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Route as RouteEnum } from '@/enums/routerEnum';
import LoginPage from '@/modules/Auth/Login/LoginPage';
import RegisterPage from '@/modules/Auth/register/RegisterPage';
import GroupPage from '@/modules/groups/GroupPage';
import HomePage from '@/modules/home/HomePage';
import ProjectsPage from '@/modules/projects/ProjectPage';
import { BudgetPage } from '@/modules/budget/BudgetPage';
import { PrivateRoutes } from '@/components/Auth/PrivateRoute';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path={RouteEnum.LOGIN} element={<LoginPage />} />
      <Route path={RouteEnum.REGISTER} element={<RegisterPage />} />
      <Route path={RouteEnum.HOME} element={<HomePage />} />
      <Route path={RouteEnum.GROUPS} element={<GroupPage />} />
      <Route path={RouteEnum.PROJECTS} element={<ProjectsPage />} />

      {/* Protected routes */}
      <Route element={<PrivateRoutes />}>
        <Route path={RouteEnum.BUDGET} element={<BudgetPage />} />
      </Route>
    </Routes>
  );
};
