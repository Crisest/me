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
