import { BrowserRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '@/modules/Auth/Login/LoginPage';
import GroupPage from '@/modules/groups/GroupPage';
import { Route as RouteEnum } from './enums/routerEnum';
import Sidebar from './components/Sidebar/Sidebar';
import HomePage from '@/modules/home/HomePage';
import ProjectsPage from '@/modules/projects/ProjectPage';
import { BudgetPage } from '@/modules/budget/BudgetPage';

function App(): JSX.Element {
  return (
    <div className="app-container">
      <BrowserRouter>
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path={RouteEnum.LOGIN} element={<LoginPage />} />
            <Route path={RouteEnum.GROUPS} element={<GroupPage />} />
            <Route path={RouteEnum.HOME} element={<HomePage />} />
            <Route path={RouteEnum.PROJECTS} element={<ProjectsPage />} />
            <Route path={RouteEnum.BUDGET} element={<LoginPage />} />
            {/* Add more routes as needed */}
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;
