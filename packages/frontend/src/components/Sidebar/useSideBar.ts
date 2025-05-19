import { Route } from '@/enums/routerEnum';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const useSideBar = () => {
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setSelectedTab(pathname);
  }, [pathname]);

  return selectedTab;
};

export default useSideBar;

// Utilities
export const buttonData: ButtonData[] = [
  {
    text: 'Home',
    to: Route.HOME,
  },
  {
    text: 'Projects',
    to: Route.PROJECTS,
  },
  {
    text: 'Budget',
    to: Route.BUDGET,
  },
];

interface ButtonData {
  text: string;
  to: Route;
}
