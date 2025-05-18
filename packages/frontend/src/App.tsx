import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import LoginPage from '@/modules/Auth/Login/LoginPage';
import GroupPage from '@/modules/groups/GroupPage';
import { Route as RouteEnum } from './enums/routerEnum';
import Sidebar from './components/Sidebar/Sidebar';
import HomePage from '@/modules/home/HomePage';
import ProjectsPage from '@/modules/projects/ProjectPage';
import { BudgetPage } from '@/modules/budget/BudgetPage';
import RegisterPage from './modules/Auth/register/RegisterPage';
import { PrivateRoutes } from './components/Auth/PrivateRoute';

function App(): JSX.Element {
  return (
    <Provider store={store}>
      <div className="app-container">
        <BrowserRouter>
          <Sidebar />
          <div className="main-content">
            <Routes>
              <Route path={RouteEnum.LOGIN} element={<LoginPage />} />
              <Route path={RouteEnum.GROUPS} element={<GroupPage />} />
              <Route path={RouteEnum.HOME} element={<HomePage />} />
              <Route path={RouteEnum.PROJECTS} element={<ProjectsPage />} />
              <Route path={RouteEnum.REGISTER} element={<RegisterPage />} />

              <Route element={<PrivateRoutes />}>
                <Route path={RouteEnum.BUDGET} element={<BudgetPage />} />
              </Route>
              {/* Add more routes as needed */}
            </Routes>
          </div>
        </BrowserRouter>
      </div>
    </Provider>
  );
}

export default App;
