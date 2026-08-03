import { Route } from '@/enums/routerEnum';
import { useLocation } from 'react-router-dom';

// Routes a sidebar entry can highlight for. The active tab is the longest
// one that matches the current path, so nested routes like
// `/shared/:groupId` still light up the `Shared` tab.
const navRoutes: Route[] = [Route.HOME, Route.SHARED, Route.PROFILE];

const useSideBar = () => {
  const { pathname } = useLocation();

  const selectedTab =
    navRoutes
      .filter(route =>
        route === Route.HOME
          ? pathname === Route.HOME
          : pathname === route || pathname.startsWith(`${route}/`)
      )
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return selectedTab;
};

export default useSideBar;

// Utilities
export const buttonData: ButtonData[] = [
  {
    text: 'Budget',
    to: Route.HOME,
  },
  {
    text: 'Shared',
    to: Route.SHARED,
  },
];

interface ButtonData {
  text: string;
  to: Route;
}
